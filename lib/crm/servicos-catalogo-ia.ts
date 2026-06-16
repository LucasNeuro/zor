import type { SupabaseClient } from "@supabase/supabase-js";
import { mistralMemoryModelId } from "@/lib/ia/hub-model-defaults";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import {
  carregarAnaliseConhecimentoTenant,
  itensCatalogoFromAnalise,
  type ServicoCatalogoItemInput,
} from "@/lib/crm/servicos-catalogo";

function parseJsonArray(raw: string): unknown[] | null {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : t).trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { servicos?: unknown }).servicos)) {
      return (parsed as { servicos: unknown[] }).servicos;
    }
    return null;
  } catch {
    const start = body.indexOf("[");
    const end = body.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizarItens(arr: unknown[], max = 40): ServicoCatalogoItemInput[] {
  const out: ServicoCatalogoItemInput[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.nome === "string" ? o.nome.trim() : "";
    if (!nome || nome.length < 2) continue;
    let preco: number | null = null;
    if (typeof o.preco_referencia === "number" && Number.isFinite(o.preco_referencia)) {
      preco = o.preco_referencia;
    } else if (typeof o.preco === "number" && Number.isFinite(o.preco)) {
      preco = o.preco;
    } else if (typeof o.preco_referencia === "string") {
      const n = Number.parseFloat(o.preco_referencia.replace(/[^\d.,]/g, "").replace(",", "."));
      if (Number.isFinite(n) && n > 0) preco = n;
    }
    const descricao =
      typeof o.descricao === "string" ? o.descricao.trim().slice(0, 500) || undefined : undefined;
    out.push({
      nome: nome.slice(0, 200),
      descricao: descricao ?? null,
      preco_referencia: preco,
      origem: "conhecimento_ia",
      ordem: out.length,
    });
    if (out.length >= max) break;
  }
  return out;
}

async function carregarTextoConhecimentoParaCatalogo(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const partes: string[] = [];

  const { data: docs } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, titulo, nome_arquivo, texto_extraido, resumo_ia")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto")
    .order("indexado_em", { ascending: false })
    .limit(8);

  for (const doc of docs ?? []) {
    const titulo = String(doc.titulo ?? doc.nome_arquivo ?? "Documento").trim();
    const texto = String(doc.texto_extraido ?? "").trim();
    if (texto.length > 80) {
      partes.push(`### ${titulo}\n${texto.slice(0, 6000)}`);
      continue;
    }
    const resumo = doc.resumo_ia;
    if (resumo && typeof resumo === "object") {
      partes.push(`### ${titulo}\n${JSON.stringify(resumo).slice(0, 3000)}`);
    }
  }

  const { data: chunks } = await supabase
    .from("hub_tenant_conhecimento_chunk")
    .select("conteudo, chunk_index, document_id")
    .eq("tenant_id", tenantId)
    .order("chunk_index", { ascending: true })
    .limit(60);

  const precos = (chunks ?? [])
    .map((c) => String(c.conteudo ?? "").trim())
    .filter(
      (t) =>
        t.length > 30 &&
        /\b(r\$|preço|preco|tabela|serviço|servico|troca|reparo|orçamento|orcamento|valor)\b/i.test(t)
    )
    .slice(0, 25);

  if (precos.length) {
    partes.push("### Trechos com preços/serviços\n" + precos.join("\n---\n").slice(0, 14_000));
  }

  return partes.join("\n\n").slice(0, 24_000);
}

/** Extrai serviços + preços da base de conhecimento indexada via IA. */
export async function extrairServicosCatalogoViaIa(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ServicoCatalogoItemInput[]> {
  const texto = await carregarTextoConhecimentoParaCatalogo(supabase, tenantId);
  if (texto.length < 80) {
    const analise = await carregarAnaliseConhecimentoTenant(supabase, tenantId);
    return analise ? itensCatalogoFromAnalise(analise) : [];
  }

  const system = `Extrai o CATÁLOGO DE SERVIÇOS/PRODUTOS da empresa a partir da documentação.
Responda APENAS JSON array: [{"nome":"...","descricao":"...","preco_referencia":123.45}]
Regras:
- Só itens explicitamente mencionados (reparos, serviços, produtos, pacotes).
- preco_referencia em BRL quando houver valor na tabela; omita se não houver preço.
- Máx. 35 itens; nomes curtos em português; sem duplicar.
- Inclua assistência técnica, troca de tela, bateria, etc. se aparecerem nos textos.`;

  const out = await mistralChatCompletion({
    model: mistralMemoryModelId(),
    system,
    messages: [{ role: "user", content: texto }],
    maxTokens: 2048,
    temperature: 0.15,
  });

  if (!out.ok || !out.text.trim()) {
    const analise = await carregarAnaliseConhecimentoTenant(supabase, tenantId);
    return analise ? itensCatalogoFromAnalise(analise) : [];
  }

  const arr = parseJsonArray(out.text);
  if (!arr?.length) {
    const analise = await carregarAnaliseConhecimentoTenant(supabase, tenantId);
    return analise ? itensCatalogoFromAnalise(analise) : [];
  }

  const iaItens = normalizarItens(arr);
  const analise = await carregarAnaliseConhecimentoTenant(supabase, tenantId);
  const base = analise ? itensCatalogoFromAnalise(analise) : [];
  const seen = new Set<string>();
  const merged: ServicoCatalogoItemInput[] = [];

  for (const item of [...iaItens, ...base]) {
    const key = item.nome.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item, ordem: merged.length });
  }

  return merged;
}
