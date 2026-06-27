import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeLeadEhPlaceholder } from "@/lib/crm/sincronizar-contato-whatsapp";
import { extrairMemoriasLeadViaLlm } from "@/lib/ia/memoria-llm";

export const CHAVE_NOME_LEAD = "nome";

/** Normaliza chave de memória (`nome_auto` → `nome`). */
export function normalizarChaveMemoria(chave: string): string {
  return (chave || "").toLowerCase().replace(/_auto$/, "");
}

/**
 * Grava um único nome canónico por lead (substitui linhas antigas com chave `nome`).
 * Evita Renato + Marcelo coexistirem e o patch CRM preferir o nome errado.
 */
export async function salvarMemoriaNomeLead(
  supabase: SupabaseClient,
  leadId: string,
  nome: string,
  criadoPor: string,
  confianca = 0.95
): Promise<void> {
  const valor = nome.trim().slice(0, 240);
  if (!valor || nomeLeadEhPlaceholder(valor)) return;

  const { data: rows } = await supabase
    .from("hub_memorias_lead")
    .select("id, valor")
    .eq("lead_id", leadId)
    .eq("chave", CHAVE_NOME_LEAD)
    .order("criado_em", { ascending: false });

  const existentes = rows ?? [];
  const principal = existentes[0];

  if (principal?.id) {
    await supabase
      .from("hub_memorias_lead")
      .update({
        valor,
        confianca,
        criado_por: criadoPor,
        criado_em: new Date().toISOString(),
      })
      .eq("id", principal.id);

    const duplicados = existentes.slice(1).map((r) => r.id).filter(Boolean);
    if (duplicados.length > 0) {
      await supabase.from("hub_memorias_lead").delete().in("id", duplicados);
    }
    return;
  }

  await supabase.from("hub_memorias_lead").insert({
    lead_id: leadId,
    chave: CHAVE_NOME_LEAD,
    valor,
    confianca,
    criado_por: criadoPor,
  });
}

/** Nome confirmado mais recente em hub_memorias_lead (independe da janela de sessão). */
export async function carregarNomeMemoriaLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("hub_memorias_lead")
    .select("valor")
    .eq("lead_id", leadId)
    .eq("chave", CHAVE_NOME_LEAD)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nome = typeof data?.valor === "string" ? data.valor.trim() : "";
  if (!nome || nomeLeadEhPlaceholder(nome)) return null;
  return nome.slice(0, 240);
}

/** No prompt, só uma entrada `nome` (a mais recente). */
export function deduplicarMemoriasParaPrompt(
  memorias: Array<{ chave: string; valor: string }>
): Array<{ chave: string; valor: string }> {
  const vistos = new Set<string>();
  const out: Array<{ chave: string; valor: string }> = [];

  for (const m of memorias) {
    const base = normalizarChaveMemoria(m.chave);
    if (base === CHAVE_NOME_LEAD) {
      if (vistos.has(CHAVE_NOME_LEAD)) continue;
      vistos.add(CHAVE_NOME_LEAD);
      out.push({ chave: CHAVE_NOME_LEAD, valor: m.valor });
      continue;
    }
    out.push(m);
  }

  return out;
}

const PADROES_LEAD: Array<{ regex: RegExp; tipo: string; relevancia: number }> = [
  { regex: /não (tenho|quero|posso|consigo|preciso)/gi, tipo: "objecao", relevancia: 0.8 },
  { regex: /preciso de|estou procurando|quero|gostaria|interesse/gi, tipo: "interesse", relevancia: 0.7 },
  { regex: /prefiro|gosto de|sempre uso|tenho costume/gi, tipo: "preferencia", relevancia: 0.6 },
  { regex: /comprei|fechei|acordo|contrato|fechamos/gi, tipo: "compra", relevancia: 0.9 },
  { regex: /orçamento|budget|investimento|valor|preço/gi, tipo: "financeiro", relevancia: 0.7 },
  { regex: /urgente|preciso logo|prazo|quando|data/gi, tipo: "comportamento", relevancia: 0.6 },
];

async function upsertMemoriaLead(
  supabase: SupabaseClient,
  leadId: string,
  chave: string,
  valor: string,
  confianca: number
): Promise<void> {
  const snippet = valor.slice(0, Math.min(20, valor.length));
  const { data: existente } = await supabase
    .from("hub_memorias_lead")
    .select("id, confianca")
    .eq("lead_id", leadId)
    .eq("chave", chave)
    .ilike("valor", `%${snippet}%`)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("hub_memorias_lead")
      .update({ confianca: Math.min(1, Number(existente.confianca) + 0.08) })
      .eq("id", existente.id);
    return;
  }

  await supabase.from("hub_memorias_lead").insert({
    lead_id: leadId,
    chave,
    valor,
    confianca,
    criado_por: "ia_engine",
  });
}

function extrairMemoriasLeadRegex(mensagemUsuario: string, respostaIA: string) {
  const texto = `${mensagemUsuario} ${respostaIA}`.toLowerCase();
  const out: Array<{ chave: string; valor: string; confianca: number }> = [];
  for (const padrao of PADROES_LEAD) {
    const matches = texto.match(padrao.regex);
    if (!matches) continue;
    for (const match of matches.slice(0, 2)) {
      out.push({
        chave: `${padrao.tipo}_auto`,
        valor: match.slice(0, 200),
        confianca: padrao.relevancia,
      });
    }
  }
  return out;
}

/** LLM primeiro; fallback regex se Mistral indisponível ou sem resultados. */
export async function extrairESalvarMemoriasLead(
  supabase: SupabaseClient,
  leadId: string,
  mensagemUsuario: string,
  respostaIA: string
): Promise<void> {
  let memorias = await extrairMemoriasLeadViaLlm({ mensagemUsuario, respostaIA });
  if (!memorias.length) {
    memorias = extrairMemoriasLeadRegex(mensagemUsuario, respostaIA);
  }

  for (const m of memorias) {
    const chaveBase = normalizarChaveMemoria(m.chave);
    if (chaveBase === CHAVE_NOME_LEAD) {
      await salvarMemoriaNomeLead(supabase, leadId, m.valor, "ia_engine", m.confianca);
      continue;
    }
    const chave = m.chave.endsWith("_auto") ? m.chave : `${m.chave}_auto`;
    await upsertMemoriaLead(supabase, leadId, chave, m.valor, m.confianca);
  }
}

export const CHAVE_RESUMO_CONVERSA = "resumo_conversa";

export type ResumoConversaMeta = {
  texto: string;
  total_mensagens: number;
  atualizado_em: string;
};

export async function carregarResumoConversa(
  supabase: SupabaseClient,
  leadId: string
): Promise<ResumoConversaMeta | null> {
  const { data } = await supabase
    .from("hub_memorias_lead")
    .select("valor, criado_em")
    .eq("lead_id", leadId)
    .eq("chave", CHAVE_RESUMO_CONVERSA)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.valor) return null;
  try {
    const p = JSON.parse(String(data.valor)) as ResumoConversaMeta;
    if (p && typeof p.texto === "string") return p;
  } catch {
    return {
      texto: String(data.valor).slice(0, 1200),
      total_mensagens: 0,
      atualizado_em: String(data.criado_em ?? new Date().toISOString()),
    };
  }
  return null;
}

/** Memórias recentes do lead para o prompt (Supabase — sem cache Redis). */
export async function listarMemoriasLeadParaPrompt(
  supabase: SupabaseClient,
  leadId: string,
  opts?: { cutoffIso?: string; limit?: number }
): Promise<Array<{ chave: string; valor: string }>> {
  let q = supabase
    .from("hub_memorias_lead")
    .select("chave, valor")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false })
    .limit(opts?.limit ?? 8);

  if (opts?.cutoffIso) {
    q = q.gte("criado_em", opts.cutoffIso);
  }

  const { data } = await q;
  return deduplicarMemoriasParaPrompt((data ?? []) as Array<{ chave: string; valor: string }>);
}

export async function salvarResumoConversa(
  supabase: SupabaseClient,
  leadId: string,
  texto: string,
  totalMensagens: number
): Promise<void> {
  const payload: ResumoConversaMeta = {
    texto: texto.slice(0, 1200),
    total_mensagens: totalMensagens,
    atualizado_em: new Date().toISOString(),
  };

  const { data: existente } = await supabase
    .from("hub_memorias_lead")
    .select("id")
    .eq("lead_id", leadId)
    .eq("chave", CHAVE_RESUMO_CONVERSA)
    .maybeSingle();

  if (existente?.id) {
    await supabase
      .from("hub_memorias_lead")
      .update({ valor: JSON.stringify(payload), confianca: 0.95, criado_por: "ia_engine" })
      .eq("id", existente.id);
    return;
  }

  await supabase.from("hub_memorias_lead").insert({
    lead_id: leadId,
    chave: CHAVE_RESUMO_CONVERSA,
    valor: JSON.stringify(payload),
    confianca: 0.95,
    criado_por: "ia_engine",
  });
}
