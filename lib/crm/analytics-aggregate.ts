import type { SupabaseClient } from "@supabase/supabase-js";
import { legacyToFunil } from "@/lib/crm/estagio-map";
import { metricasLeadsFromRows, POSTGREST_LEAD_TERMINAIS } from "@/lib/crm/estagio-filters";
import { safeCount, safeSelectRows } from "@/lib/crm/metricas-safe";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { sinceFromPeriodo } from "@/lib/crm/analytics-period";
import { FUNIL_LEAD_ETAPAS } from "@/lib/crm/pipelines";
import {
  buildFunilNegociosPorMercado,
  type EstagioPipelineRef,
} from "@/lib/crm/funil-analytics";
import { tenantAgentSlugs } from "@/lib/crm/dashboard-aggregate";

async function loadEstagiosPipelineNegocio(
  supabase: SupabaseClient,
  mercadoPrefixo: string
): Promise<EstagioPipelineRef[] | undefined> {
  const { data, error } = await supabase
    .from("hub_pipelines")
    .select("hub_pipeline_estagios(slug, label, cor, ordem, ativo)")
    .eq("tipo", "negocio")
    .eq("mercado_sigla", mercadoPrefixo.toUpperCase())
    .eq("ativo", true)
    .maybeSingle();

  if (error || !data) return undefined;

  const raw = data as Record<string, unknown>;
  const estagios = (raw.hub_pipeline_estagios as Record<string, unknown>[] | null) ?? [];
  const sorted = [...estagios]
    .filter((e) => e.ativo !== false)
    .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));

  if (sorted.length === 0) return undefined;

  return sorted.map((e) => ({
    slug: String(e.slug),
    label: String(e.label ?? e.slug),
    cor: e.cor != null ? String(e.cor) : null,
  }));
}

export const KPI_METAS_DEFAULT: Record<string, number | null> = {
  taxa_qualificacao: 40,
  taxa_conversao_negocio: 15,
  pipeline_aberto: null,
  leads_hoje: null,
  aprovacoes_pendentes: 5,
  mensagens_fila_pendentes: 10,
};

export type KpiCard = {
  slug: string;
  nome: string;
  unidade: string;
  valor: number;
  valor_meta: number | null;
  nivel_alerta: "ok" | "atencao" | "critico";
  progresso_pct: number | null;
};

export type AnalyticsPayload = {
  periodo: AnalyticsPeriodo;
  since: string;
  kpis: KpiCard[];
  metricas: {
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
  funilLeads: { id: string; label: string; count: number; color: string }[];
  /** Preenchido apenas quando GET /api/crm/analytics inclui ?mercado=PREFIXO */
  funilNegocios: { id: string; label: string; count: number; color: string }[];
  funilNegociosMercado?: string;
  leadsPorDia: { dia: string; label: string; count: number }[];
  atendimento: {
    filaPendente: number;
    leadsAguardando: number;
    agentesAtivos: number;
  };
  parceiros: {
    homologados: number;
    encaminhamentosPeriodo: number;
    taxaEncaminhamento: number;
  };
  marketing: {
    spend: number;
    clicks: number;
    cpc: number;
    campanhas: number;
  } | null;
  operacao: { conversasAtivas: number; leadsAtivos: number };
  ia: {
    kpisCriticos: number;
    ciclosComFalha: number;
    observacoesMl: { tipo: string; descricao: string; amostras: number }[];
  };
  alertas: { id: string; titulo: string; nivel: string; criado_em: string }[];
  ultimosResultados: {
    kpi_slug: string;
    valor_medido: number;
    nivel_alerta: string;
    criado_em: string;
  }[];
};

function nivelFromValor(
  valor: number,
  meta: number | null,
  slug: string
): "ok" | "atencao" | "critico" {
  if (meta == null) return "ok";
  if (slug === "aprovacoes_pendentes" || slug === "mensagens_fila_pendentes") {
    if (valor > meta * 2) return "critico";
    if (valor > meta) return "atencao";
    return "ok";
  }
  if (valor >= meta) return "ok";
  if (valor >= meta * 0.7) return "atencao";
  return "critico";
}

function progressoPct(valor: number, meta: number | null, slug: string): number | null {
  if (meta == null || meta === 0) return null;
  if (slug === "aprovacoes_pendentes" || slug === "mensagens_fila_pendentes") {
    return Math.min(100, Math.round((valor / meta) * 100));
  }
  return Math.min(100, Math.round((valor / meta) * 100));
}

function agruparLeadsPorDia(rows: { criado_em: string }[], sinceMs: number): AnalyticsPayload["leadsPorDia"] {
  const buckets = new Map<string, number>();
  const now = new Date();
  const days =
    sinceMs <= 86400000 ? 1 : sinceMs <= 7 * 86400000 ? 7 : 30;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }

  for (const r of rows) {
    const key = new Date(r.criado_em).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([dia, count]) => ({
    dia,
    label: new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    count,
  }));
}

export async function aggregateAnalytics(
  supabase: SupabaseClient,
  tenantId: string,
  periodo: AnalyticsPeriodo,
  mercadoPrefixo?: string
): Promise<AnalyticsPayload> {
  const since = sinceFromPeriodo(periodo);
  const sinceMs = Date.now() - new Date(since).getTime();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const sinceHoje = hoje.toISOString();
  const agentSlugs = await tenantAgentSlugs(supabase, tenantId);
  const kpiAgentSlugs = agentSlugs.length > 0 ? [...agentSlugs, "crm", "_hub"] : [];

  let resultadosKpiQuery = supabase
    .from("hub_kpis_resultados")
    .select("kpi_slug, valor_medido, valor_meta, nivel_alerta, criado_em, agente_slug")
    .gte("criado_em", since)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (kpiAgentSlugs.length > 0) {
    resultadosKpiQuery = resultadosKpiQuery.in("agente_slug", kpiAgentSlugs);
  }

  const [
    definicoesRes,
    resultadosRes,
    leadsRes,
    negRes,
    leadsPeriodoRes,
    comNegocio,
    negociosAbertos,
    leadsHoje,
    aprovPend,
    filaPend,
    agentes,
    parceiros,
    encPeriodoRes,
    conversasAtivas,
    leadsAtivos,
    kpisCriticosRes,
  ] = await Promise.all([
    supabase.from("hub_kpis_definicao").select("slug, nome, unidade").eq("ativo", true),
    resultadosKpiQuery,
    supabase
      .from("hub_leads_crm")
      .select("estagio")
      .eq("tenant_id", tenantId),
    supabase
      .from("hub_negocios")
      .select("etapa, status, prefixo_mercado")
      .eq("tenant_id", tenantId),
    supabase
      .from("hub_leads_crm")
      .select("criado_em")
      .eq("tenant_id", tenantId)
      .gte("criado_em", since),
    safeCount(
      supabase
        .from("hub_negocios")
        .select("lead_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("lead_id", "is", null)
    ),
    supabase
      .from("hub_negocios")
      .select("valor_estimado")
      .eq("tenant_id", tenantId)
      .in("status", ["aberto", "em_negociacao"]),
    safeCount(
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("criado_em", sinceHoje)
    ),
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
      .gte("encaminhado_em", since),
    safeCount(
      supabase
        .from("hub_conversas")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "ativa")
    ),
    safeCount(
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("estagio", "in", POSTGREST_LEAD_TERMINAIS)
    ),
    safeCount(
      (() => {
        let q = supabase
          .from("hub_kpis_resultados")
          .select("id", { count: "exact", head: true })
          .neq("nivel_alerta", "ok")
          .gte("criado_em", since);
        if (kpiAgentSlugs.length > 0) {
          q = q.in("agente_slug", kpiAgentSlugs);
        }
        return q;
      })()
    ),
  ]);

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

  const [alertasRows, mlRows, ciclosRows] = await Promise.all([
    safeSelectRows(alertasQuery),
    safeSelectRows(
      supabase
        .from("hub_ml_observacoes")
        .select("tipo, descricao, amostras")
        .order("criado_em", { ascending: false })
        .limit(5)
    ),
    safeSelectRows(
      supabase
        .from("hub_ciclos_ia")
        .select("ultimo_status")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
    ),
  ]);

  if (leadsRes.error) {
    console.warn("[analytics] hub_leads_crm", leadsRes.error.message ?? leadsRes.error);
  }
  const leadsRows = (leadsRes.error ? [] : (leadsRes.data ?? [])) as { estagio: string | null }[];
  const leadMetricas = metricasLeadsFromRows(leadsRows, (e) => String(legacyToFunil(e)));
  const totalLeads = leadMetricas.total;
  const qualificados = leadMetricas.qualificados;
  const aguardando = leadMetricas.aguardando;

  const taxaQual = totalLeads > 0 ? Math.round((qualificados / totalLeads) * 100) : 0;
  const taxaConv = totalLeads > 0 ? Math.round((comNegocio / totalLeads) * 100) : 0;
  const pipeline = (negociosAbertos.data ?? []).reduce(
    (s, r) => s + Number((r as { valor_estimado?: number }).valor_estimado ?? 0),
    0
  );
  const encRows = encPeriodoRes.error ? [] : (encPeriodoRes.data ?? []);
  const encPeriodo = encRows.length;
  const leadsComEncPeriodo = new Set(
    encRows.map((r) => (r as { lead_id: string | null }).lead_id).filter((id): id is string => id != null && id !== "")
  ).size;
  const taxaEnc = totalLeads > 0 ? Math.round((leadsComEncPeriodo / totalLeads) * 100) : 0;

  const liveValues: Record<string, number> = {
    taxa_qualificacao: taxaQual,
    taxa_conversao_negocio: taxaConv,
    pipeline_aberto: pipeline,
    leads_hoje: leadsHoje,
    aprovacoes_pendentes: aprovPend,
    mensagens_fila_pendentes: filaPend,
  };

  const latestBySlug = new Map<string, { valor_medido: number; valor_meta: number | null; nivel_alerta: string }>();
  for (const r of resultadosRes.data ?? []) {
    const row = r as {
      kpi_slug: string;
      valor_medido: number;
      valor_meta: number | null;
      nivel_alerta: string;
      agente_slug?: string;
    };
    if (row.agente_slug && row.agente_slug !== "crm" && row.agente_slug !== "_hub") continue;
    if (!latestBySlug.has(row.kpi_slug)) {
      latestBySlug.set(row.kpi_slug, {
        valor_medido: Number(row.valor_medido),
        valor_meta: row.valor_meta != null ? Number(row.valor_meta) : null,
        nivel_alerta: row.nivel_alerta,
      });
    }
  }

  const defs = (definicoesRes.data ?? []) as { slug: string; nome: string; unidade: string }[];
  const slugsOrdenados =
    defs.length > 0
      ? defs.map((d) => d.slug)
      : Object.keys(KPI_METAS_DEFAULT);

  const kpis: KpiCard[] = slugsOrdenados.map((slug) => {
    const def = defs.find((d) => d.slug === slug);
    const stored = latestBySlug.get(slug);
    const valor = stored?.valor_medido ?? liveValues[slug] ?? 0;
    const meta = stored?.valor_meta ?? KPI_METAS_DEFAULT[slug] ?? null;
    const nivel = (stored?.nivel_alerta as KpiCard["nivel_alerta"]) ?? nivelFromValor(valor, meta, slug);
    return {
      slug,
      nome: def?.nome ?? slug,
      unidade: def?.unidade ?? "%",
      valor,
      valor_meta: meta,
      nivel_alerta: nivel,
      progresso_pct: progressoPct(valor, meta, slug),
    };
  });

  const leadCounts: Record<string, number> = {};
  for (const s of FUNIL_LEAD_ETAPAS) leadCounts[s.slug] = leadMetricas.counts[s.slug] ?? 0;

  const negRows = (negRes.data ?? []) as {
    etapa: string;
    status: string;
    prefixo_mercado?: string | null;
  }[];

  let funilNegocios: AnalyticsPayload["funilNegocios"] = [];
  let funilNegociosMercado: string | undefined;

  if (mercadoPrefixo) {
    const prefixo = mercadoPrefixo.trim().toUpperCase();
    const estagiosDb = await loadEstagiosPipelineNegocio(supabase, prefixo);
    funilNegocios = buildFunilNegociosPorMercado(negRows, prefixo, estagiosDb);
    funilNegociosMercado = prefixo;
  }

  const ciclosComFalha = ciclosRows.filter(
    (c) => (c as { ultimo_status?: string }).ultimo_status === "erro"
  ).length;

  let marketing: AnalyticsPayload["marketing"] = null;
  const windsorKey = process.env.WINDSOR_API_KEY?.trim();
  if (windsorKey) {
    try {
      const dateTo = new Date().toISOString().split("T")[0];
      const daysBack = periodo === "30d" ? 30 : periodo === "7d" ? 7 : 1;
      const dateFrom = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];
      const res = await fetch(
        `https://connectors.windsor.ai/facebook?api_key=${windsorKey}&date_from=${dateFrom}&date_to=${dateTo}&fields=campaign,spend,clicks`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const json = (await res.json()) as { data?: { spend?: number; clicks?: number }[] };
        const rows = json?.data ?? [];
        const spend = rows.reduce((s, x) => s + Number(x.spend ?? 0), 0);
        const clicks = rows.reduce((s, x) => s + Number(x.clicks ?? 0), 0);
        marketing = {
          spend,
          clicks,
          cpc: clicks > 0 ? spend / clicks : 0,
          campanhas: rows.length,
        };
      }
    } catch {
      marketing = null;
    }
  }

  return {
    periodo,
    since,
    kpis,
    metricas: {
      leadsHoje,
      leadsAguardando: aguardando,
      aprovacoesPendentes: aprovPend,
      mensagensFilaPendentes: filaPend,
      agentesAtivos: agentes,
      receitaPotencial: pipeline,
      parceirosAtivos: parceiros,
      encaminhamentosHoje: encPeriodo,
      taxaQualificacao: taxaQual,
      taxaEncaminhamento: taxaEnc,
    },
    funilLeads: FUNIL_LEAD_ETAPAS.map((s) => ({
      id: s.slug,
      label: s.label,
      count: leadCounts[s.slug] ?? 0,
      color: s.cor,
    })),
    funilNegocios,
    ...(funilNegociosMercado ? { funilNegociosMercado } : {}),
    leadsPorDia: agruparLeadsPorDia(
      (leadsPeriodoRes.data ?? []) as { criado_em: string }[],
      sinceMs
    ),
    atendimento: {
      filaPendente: filaPend,
      leadsAguardando: aguardando,
      agentesAtivos: agentes,
    },
    parceiros: {
      homologados: parceiros,
      encaminhamentosPeriodo: encPeriodo,
      taxaEncaminhamento: taxaEnc,
    },
    marketing,
    operacao: { conversasAtivas, leadsAtivos },
    ia: {
      kpisCriticos: kpisCriticosRes,
      ciclosComFalha,
      observacoesMl: mlRows.map((o) => ({
        tipo: String((o as { tipo: string }).tipo),
        descricao: String((o as { descricao: string }).descricao),
        amostras: Number((o as { amostras?: number }).amostras ?? 0),
      })),
    },
    alertas: alertasRows.map((a) => ({
      id: String((a as { id: string }).id),
      titulo: String((a as { titulo?: string }).titulo ?? "Alerta"),
      nivel: String((a as { tipo?: string }).tipo ?? "info"),
      criado_em: String((a as { criado_em: string }).criado_em),
    })),
    ultimosResultados: (resultadosRes.data ?? []).slice(0, 12).map((r) => ({
      kpi_slug: String((r as { kpi_slug: string }).kpi_slug),
      valor_medido: Number((r as { valor_medido: number }).valor_medido),
      nivel_alerta: String((r as { nivel_alerta: string }).nivel_alerta),
      criado_em: String((r as { criado_em: string }).criado_em),
    })),
  };
}
