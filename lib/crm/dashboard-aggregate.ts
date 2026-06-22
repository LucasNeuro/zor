import type { SupabaseClient } from "@supabase/supabase-js";
import { legacyToFunil } from "@/lib/crm/estagio-map";
import { ESTAGIOS_LEAD_TERMINAIS, metricasLeadsFromRows } from "@/lib/crm/estagio-filters";
import { safeCount } from "@/lib/crm/metricas-safe";

export type CrmMetricas = {
  leadsHoje: number;
  leadsAguardando: number;
  aprovacoesPendentes: number;
  mensagensFilaPendentes: number;
  agentesAtivos: number;
  receitaPotencial: number;
  parceirosAtivos: number;
  encaminhamentosHoje: number;
  taxaQualificacao: number;
  taxaEncaminhamento: number;
};

export type AlertaResumo = {
  id: string;
  titulo: string;
  tipo: string;
  criado_em: string;
};

export type LeadRecente = {
  id: string;
  nome: string | null;
  estagio: string | null;
  criado_em: string;
  atualizado_em: string | null;
};

export type CicloStatus = {
  agente_slug: string;
  ultimo_status: string | null;
};

export type OperacaoResumo = {
  negociosAbertos: number;
  obrasEmAndamento: number;
  pedidosAbertos: number;
};

export type DashboardPayload = CrmMetricas & {
  alertas: AlertaResumo[];
  leadsRecentes: LeadRecente[];
  ciclos: CicloStatus[];
  operacao: OperacaoResumo;
};

function inicioDiaUtcISO(): string {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  ).toISOString();
}

async function tenantAgentSlugs(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug")
    .eq("tenant_id", tenantId);

  if (error || !data) return [];
  return data
    .map((row) => String((row as { agente_slug?: string | null }).agente_slug ?? "").trim())
    .filter(Boolean);
}

export async function fetchCrmMetricas(
  supabase: SupabaseClient,
  tenantId: string,
  since?: string
): Promise<CrmMetricas> {
  const sinceIso = since ?? inicioDiaUtcISO();

  const [
    leadsHoje,
    leadsRowsRes,
    aprovs,
    msgs,
    agentes,
    parceiros,
    encRowsRes,
    negPipeRes,
  ] = await Promise.all([
    safeCount(
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("criado_em", sinceIso)
    ),
    supabase
      .from("hub_leads_crm")
      .select("estagio, valor_estimado")
      .eq("tenant_id", tenantId),
    safeCount(
      supabase
        .from("hub_aprovacoes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pendente")
    ),
    safeCount(
      supabase
        .from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direcao", "entrada")
        .eq("status", "pendente")
    ),
    safeCount(
      supabase
        .from("hub_agente_identidade")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tenant_id", tenantId)
    ),
    safeCount(
      supabase
        .from("hub_parceiros")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "homologado")
    ),
    supabase
      .from("hub_encaminhamentos")
      .select("lead_id")
      .eq("tenant_id", tenantId)
      .gte("encaminhado_em", sinceIso),
    supabase
      .from("hub_negocios")
      .select("valor_estimado")
      .eq("tenant_id", tenantId)
      .in("status", ["aberto", "em_negociacao"]),
  ]);

  const leadsRows = (leadsRowsRes.error ? [] : (leadsRowsRes.data ?? [])) as {
    estagio: string | null;
    valor_estimado?: number | null;
  }[];
  const leadMetricas = metricasLeadsFromRows(leadsRows, (e) => String(legacyToFunil(e)));
  const total = leadMetricas.total;
  const qualificados = leadMetricas.qualificados;
  const aguardando = leadMetricas.aguardando;
  const terminaisSet = new Set<string>(ESTAGIOS_LEAD_TERMINAIS);

  const receitaLeads = leadsRows
    .filter((r) => !terminaisSet.has(String(legacyToFunil(r.estagio))))
    .reduce((s, r) => s + Number(r.valor_estimado ?? 0), 0);

  const negRows = (negPipeRes.error ? [] : (negPipeRes.data ?? [])) as {
    valor_estimado?: number | null;
  }[];
  const receitaNegocios = negRows.reduce((s, r) => s + Number(r.valor_estimado ?? 0), 0);
  const receitaPotencial = receitaLeads + receitaNegocios;

  const encRows = encRowsRes.error ? [] : (encRowsRes.data ?? []) as { lead_id: string | null }[];
  const encaminhamentosHoje = encRows.length;
  const leadsComEncaminhamento = new Set(
    encRows.map((r) => r.lead_id).filter((id): id is string => id != null && id !== "")
  ).size;

  const taxaQualificacao = total > 0 ? Math.round((qualificados / total) * 100) : 0;
  const taxaEncaminhamento =
    total > 0 ? Math.round((leadsComEncaminhamento / total) * 100) : 0;

  return {
    leadsHoje,
    leadsAguardando: aguardando,
    aprovacoesPendentes: aprovs,
    mensagensFilaPendentes: msgs,
    agentesAtivos: agentes,
    receitaPotencial,
    parceirosAtivos: parceiros,
    encaminhamentosHoje,
    taxaQualificacao,
    taxaEncaminhamento,
  };
}

export async function aggregateDashboard(
  supabase: SupabaseClient,
  tenantId: string,
  since?: string
): Promise<DashboardPayload> {
  const metricas = await fetchCrmMetricas(supabase, tenantId, since);
  const agentSlugs = await tenantAgentSlugs(supabase, tenantId);

  let alertasQuery = supabase
    .from("hub_alertas")
    .select("id, titulo, tipo, criado_em")
    .eq("lido", false)
    .order("criado_em", { ascending: false })
    .limit(5);

  if (agentSlugs.length > 0) {
    alertasQuery = alertasQuery.in("agente_slug", agentSlugs);
  } else {
    alertasQuery = alertasQuery.eq("agente_slug", "__no_tenant_agents__");
  }

  const [alts, leads, cics, neg, obras, pedidos] = await Promise.all([
    alertasQuery,
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, criado_em, atualizado_em")
      .eq("tenant_id", tenantId)
      .order("atualizado_em", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("hub_ciclos_ia")
      .select("agente_slug, ultimo_status")
      .eq("tenant_id", tenantId)
      .eq("ativo", true),
    safeCount(
      supabase
        .from("hub_negocios")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["aberto", "em_negociacao"])
    ),
    safeCount(
      supabase
        .from("hub_obras")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "em_andamento")
    ),
    safeCount(
      supabase
        .from("hub_pedidos_material")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["rascunho", "cotando", "aprovado"])
    ),
  ]);

  let leadsRecentes: LeadRecente[] = [];
  if (!leads.error && leads.data) {
    leadsRecentes = leads.data as LeadRecente[];
  } else {
    const fallback = await supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, criado_em, atualizado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(5);
    leadsRecentes = (fallback.data ?? []) as LeadRecente[];
  }

  const alertas: AlertaResumo[] = !alts.error && alts.data
    ? alts.data.map((a) => ({
        id: String(a.id),
        titulo: String(a.titulo ?? "Alerta"),
        tipo: String(a.tipo ?? "info"),
        criado_em: String(a.criado_em),
      }))
    : [];

  const ciclos: CicloStatus[] = !cics.error && cics.data ? (cics.data as CicloStatus[]) : [];

  return {
    ...metricas,
    alertas,
    leadsRecentes,
    ciclos,
    operacao: {
      negociosAbertos: neg,
      obrasEmAndamento: obras,
      pedidosAbertos: pedidos,
    },
  };
}
