import type { SupabaseClient } from "@supabase/supabase-js";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { normalizarTelefoneWhatsapp } from "@/lib/crm/sincronizar-contato-whatsapp";
import { defaultTenantId } from "@/lib/tenant-default";

/** Telefone fictício estável por agente (prefixo 5598 = teste Copiloto IA). */
export function telefoneSimulacaoFromAgente(agenteSlug: string): string {
  const slug = agenteSlug.replace(/\W/g, "").toLowerCase().slice(0, 9);
  const suffix = slug.padEnd(9, "0").slice(0, 9);
  return `5598${suffix}`;
}

/** @deprecated Use telefoneSimulacaoFromAgente — mantido para migração de leads antigos por sessão. */
export function telefoneSimulacaoFromSessao(sessaoId: string): string {
  const digits = sessaoId.replace(/\D/g, "");
  const suffix = (digits || "00000000000").padEnd(11, "0").slice(0, 11);
  return `5599${suffix.slice(0, 9)}`;
}

export type LeadSimulacaoCanal = {
  leadId: string;
  telefone: string;
  nome: string;
};

/**
 * Um único lead de teste por agente + tenant (Copiloto IA / simulação interna).
 * Conversas reais de WhatsApp ou outros canais usam outros fluxos — não passam por aqui.
 */
export async function garantirLeadSimulacaoCanal(
  supabase: SupabaseClient,
  params: { sessaoId: string; agenteSlug: string; tenantId?: string | null; agenteNome?: string | null }
): Promise<LeadSimulacaoCanal> {
  const tenantId = (params.tenantId && params.tenantId.trim()) || defaultTenantId();
  const agenteSlug = params.agenteSlug.trim();
  const telefone = telefoneSimulacaoFromAgente(agenteSlug);
  const telNorm = normalizarTelefoneWhatsapp(telefone);
  const nomeExibicao =
    (params.agenteNome && params.agenteNome.trim()
      ? `Teste — ${params.agenteNome.trim()}`
      : `Teste — ${agenteSlug}`).slice(0, 120);

  const { data: porAgente } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, metadata")
    .eq("tenant_id", tenantId)
    .filter("metadata->>simulacao_agente_slug", "eq", agenteSlug)
    .filter("metadata->>simulacao_canal", "eq", "true")
    .maybeSingle();

  let existente = porAgente;

  if (!existente?.id) {
    const { data: porTel } = await supabase
      .from("hub_leads_crm")
      .select("id, nome, telefone, metadata")
      .eq("tenant_id", tenantId)
      .eq("telefone", telNorm)
      .maybeSingle();
    existente = porTel;
  }

  if (!existente?.id) {
    const { data: legadoSessao } = await supabase
      .from("hub_leads_crm")
      .select("id, nome, telefone, metadata")
      .eq("tenant_id", tenantId)
      .filter("metadata->>simulacao_briefing_sessao_id", "eq", params.sessaoId)
      .maybeSingle();
    existente = legadoSessao;
  }

  const agora = new Date().toISOString();

  if (existente?.id) {
    const meta =
      existente.metadata && typeof existente.metadata === "object" && !Array.isArray(existente.metadata)
        ? (existente.metadata as Record<string, unknown>)
        : {};

    await supabase
      .from("hub_leads_crm")
      .update({
        nome: nomeExibicao,
        telefone: telNorm,
        origem: "interno",
        agente_responsavel: agenteSlug,
        ultimo_contato: agora,
        atualizado_em: agora,
        tags: ["teste", "simulacao_canal"],
        metadata: {
          ...meta,
          origem_cadastro: "copiloto_ia_teste",
          simulacao_canal: true,
          eh_teste: true,
          simulacao_agente_slug: agenteSlug,
          simulacao_briefing_sessao_id: params.sessaoId,
          wa_telefone: telNorm,
        },
      })
      .eq("id", existente.id);

    return {
      leadId: existente.id as string,
      telefone: telNorm,
      nome: nomeExibicao,
    };
  }

  const row = await prepararRowHubLeadInsert(supabase, {
    nome: nomeExibicao,
    telefone: telNorm,
    email: null,
    origem: "interno",
    estagio: "novo",
    valor_estimado: 0,
    score: 50,
    tenant_id: tenantId,
    agente_responsavel: agenteSlug,
    tags: ["teste", "simulacao_canal"],
    metadata: {
      origem_cadastro: "copiloto_ia_teste",
      simulacao_canal: true,
      eh_teste: true,
      simulacao_agente_slug: agenteSlug,
      simulacao_briefing_sessao_id: params.sessaoId,
      wa_telefone: telNorm,
    },
  });

  const { data: criado, error } = await supabase
    .from("hub_leads_crm")
    .insert(row)
    .select("id, nome, telefone")
    .single();

  if (error || !criado) {
    throw new Error(error?.message || "Falha ao criar lead de simulação");
  }

  return {
    leadId: criado.id as string,
    telefone: telNorm,
    nome: String(criado.nome || nomeExibicao),
  };
}
