import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairMemoriasAgenteViaLlm } from "@/lib/ia/memoria-llm";
import { defaultTenantId } from "@/lib/tenant-default";

export type MemoriaAgenteOrigem =
  | "ia_engine"
  | "briefing"
  | "whatsapp"
  | "gestor_whatsapp"
  | "manual"
  | "ciclo_programado";

export type MemoriaAgenteLinha = {
  chave: string;
  valor: string;
  confianca?: number;
};

const PADROES_AGENTE: Array<{ regex: RegExp; chave: string; relevancia: number }> = [
  { regex: /sempre (usar|priorizar|evitar|confirmar)/gi, chave: "preferencia_operacional", relevancia: 0.75 },
  { regex: /problema recorrente|falha frequente|erro comum/gi, chave: "problema_recorrente", relevancia: 0.8 },
  { regex: /próximo passo|seguir com|escalar para|passar para humano/gi, chave: "fluxo_recomendado", relevancia: 0.7 },
  { regex: /clientes deste segmento|neste mercado|para leads de/gi, chave: "padrao_segmento", relevancia: 0.65 },
  { regex: /tom (formal|informal|direto|empático)|linguagem (técnica|simples)/gi, chave: "tom_preferido", relevancia: 0.6 },
  { regex: /horário|prazo|sla|tempo de resposta/gi, chave: "sla_operacional", relevancia: 0.65 },
];

async function upsertMemoriaAgente(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    chave: string;
    valor: string;
    confianca: number;
    origem: MemoriaAgenteOrigem;
  }
): Promise<void> {
  const snippet = params.valor.slice(0, Math.min(24, params.valor.length));
  const { data: existente } = await supabase
    .from("hub_memorias_agente")
    .select("id, confianca")
    .eq("agente_slug", params.agenteSlug)
    .eq("chave", params.chave)
    .ilike("valor", `%${snippet}%`)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("hub_memorias_agente")
      .update({
        confianca: Math.min(1, Number(existente.confianca ?? 0.5) + 0.08),
        origem: params.origem,
      })
      .eq("id", existente.id);
    return;
  }

  await supabase.from("hub_memorias_agente").insert({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    chave: params.chave,
    valor: params.valor,
    confianca: params.confianca,
    origem: params.origem,
    criado_por: "ia_engine",
  });
}

export async function listarMemoriasAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  limite = 6
): Promise<MemoriaAgenteLinha[]> {
  const { data, error } = await supabase
    .from("hub_memorias_agente")
    .select("chave, valor, confianca")
    .eq("agente_slug", agenteSlug)
    .order("confianca", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(Math.min(12, Math.max(1, limite)));

  if (error || !data) return [];
  return data as MemoriaAgenteLinha[];
}

export function formatarBlocoMemoriasAgente(memorias: MemoriaAgenteLinha[]): string {
  if (!memorias.length) return "";
  const linhas = memorias.map((m) => `• [${m.chave}] ${m.valor}`).join("\n");
  return `═══ MEMÓRIAS DO AGENTE (operacionais — persistem entre dias) ═══
Aprendizados deste superagente interno. Use quando relevante; não contradiga dados factuais do CRM.

${linhas}`;
}

function extrairMemoriasAgenteRegex(mensagemUsuario: string, respostaIA: string) {
  const texto = `${mensagemUsuario} ${respostaIA}`.toLowerCase();
  const out: Array<{ chave: string; valor: string; confianca: number }> = [];
  for (const padrao of PADROES_AGENTE) {
    const matches = texto.match(padrao.regex);
    if (!matches) continue;
    for (const match of matches.slice(0, 2)) {
      out.push({ chave: padrao.chave, valor: match.slice(0, 240), confianca: padrao.relevancia });
    }
  }
  return out;
}

/** LLM primeiro; fallback regex. */
export async function extrairESalvarMemoriasAgente(
  supabase: SupabaseClient,
  params: {
    agenteSlug: string;
    tenantId?: string | null;
    mensagemUsuario: string;
    respostaIA: string;
    origem: MemoriaAgenteOrigem;
  }
): Promise<void> {
  const tenant = (params.tenantId && params.tenantId.trim()) || defaultTenantId();

  let memorias = await extrairMemoriasAgenteViaLlm({
    agenteSlug: params.agenteSlug,
    mensagemUsuario: params.mensagemUsuario,
    respostaIA: params.respostaIA,
    origem: params.origem,
  });
  if (!memorias.length) {
    memorias = extrairMemoriasAgenteRegex(params.mensagemUsuario, params.respostaIA);
  }

  for (const m of memorias) {
    await upsertMemoriaAgente(supabase, {
      tenantId: tenant,
      agenteSlug: params.agenteSlug,
      chave: m.chave,
      valor: m.valor,
      confianca: m.confianca,
      origem: params.origem,
    });
  }
}
