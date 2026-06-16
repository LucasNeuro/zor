import type { SupabaseClient } from "@supabase/supabase-js";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { normalizarTelefoneWhatsapp } from "@/lib/crm/sincronizar-contato-whatsapp";
import { defaultTenantId } from "@/lib/tenant-default";

/** Telefone fictício estável por sessão de simulação (12+ dígitos, prefixo 5599). */
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
 * Garante um lead CRM isolado para a sessão de simulação (mesmo comportamento de tools que no WhatsApp).
 * Não envia mensagens reais — só permite hub_atualizar_lead, hub_lead_resumo, etc.
 */
export async function garantirLeadSimulacaoCanal(
  supabase: SupabaseClient,
  params: { sessaoId: string; agenteSlug: string; tenantId?: string | null }
): Promise<LeadSimulacaoCanal> {
  const tenantId = (params.tenantId && params.tenantId.trim()) || defaultTenantId();
  const telefone = telefoneSimulacaoFromSessao(params.sessaoId);
  const telNorm = normalizarTelefoneWhatsapp(telefone);

  const { data: porSessao } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, metadata")
    .eq("tenant_id", tenantId)
    .filter("metadata->>simulacao_briefing_sessao_id", "eq", params.sessaoId)
    .maybeSingle();

  const existente =
    porSessao ??
    (
      await supabase
        .from("hub_leads_crm")
        .select("id, nome, telefone, metadata")
        .eq("tenant_id", tenantId)
        .eq("telefone", telNorm)
        .maybeSingle()
    ).data;

  if (existente?.id) {
    const meta =
      existente.metadata && typeof existente.metadata === "object" && !Array.isArray(existente.metadata)
        ? (existente.metadata as Record<string, unknown>)
        : {};
    if (meta.simulacao_briefing_sessao_id !== params.sessaoId) {
      await supabase
        .from("hub_leads_crm")
        .update({
          metadata: {
            ...meta,
            simulacao_canal: true,
            simulacao_briefing_sessao_id: params.sessaoId,
            wa_telefone: telNorm,
          },
          agente_responsavel: params.agenteSlug,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existente.id);
    }
    return {
      leadId: existente.id as string,
      telefone: telNorm,
      nome: String(existente.nome || "Cliente simulação"),
    };
  }

  const row = await prepararRowHubLeadInsert(supabase, {
    nome: "Cliente simulação",
    telefone: telNorm,
    email: null,
    origem: "whatsapp",
    estagio: "novo",
    valor_estimado: 0,
    score: 50,
    tenant_id: tenantId,
    agente_responsavel: params.agenteSlug,
    tags: ["simulacao_canal"],
    metadata: {
      origem_cadastro: "simulacao_canal_crm",
      simulacao_canal: true,
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
    nome: String(criado.nome || "Cliente simulação"),
  };
}
