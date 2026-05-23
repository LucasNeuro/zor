import type { SupabaseClient } from "@supabase/supabase-js";
import { FUNIL_LEADS, FUNIL_NEGOCIOS } from "@/lib/crm/pipeline-funil";
import { safeCount } from "@/lib/crm/metricas-safe";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { sinceFromPeriodo } from "@/lib/crm/analytics-period";

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
  funilNegocios: { id: string; label: string; count: number; color: string }[];
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
  obras: { emAndamento: number; pedidosAbertos: number };
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

async function safeSelect<T>(
  promise: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (error.code === "PGRST205" || msg.includes("does not exist") || msg.includes("schema cache")) {
      return [] as T;
    }
    throw error;
  }
  return (data ?? []) as T;
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
  periodo: AnalyticsPeriodo
): Promise<AnalyticsPayload> {
  const since = sinceFromPeriodo(periodo);
  const sinceMs = Date.now() - new Date(since).getTime();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const sinceHoje = hoje.toISOString();

  const [
    definicoesRes,
    resultadosRes,
    leadsRes,
    negRes,
    leadsPeriodoRes,
    totalLeads,
    qualificados,
    comNegocio,
    negociosAbertos,
    leadsHoje,
    aprovPend,
    filaPend,
    agentes,
    parceiros,
    encPeriodoRes,
    obrasAndamento,
    pedidosAbertos,
    kpisCriticosRes,
  ] = await Promise.all([
    supabase.from("hub_kpis_definicao").select("slug, nome, unidade").eq("ativo", true),
    supabase
      .from("hub_kpis_resultados")
      .select("kpi_slug, valor_medido, valor_meta, nivel_alerta, criado_em, agente_slug")
      .gte("criado_em", since)
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase.from("hub_leads_crm").select("estagio").eq("tenant_id", tenantId),
    supabase.from("hub_negocios").select("etapa, status").eq("tenant_id", tenantId),
    supabase
      .from("hub_leads_crm")
      .select("criado_em")
      .eq("tenant_id", tenantId)
      .gte("criado_em", since),
    safeCount(
      supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
    ),
    safeCount(
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("estagio", "is", null)
        .neq("estagio", "")
        .not("estagio", "in", "(novo,perdido)")
    ),
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
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente")
    ),
    safeCount(
      supabase
        .from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
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
      supabase.from("hub_parceiros").select("id", { count: "exact", head: true }).eq("status", "homologado")
    ),
    supabase
      .from("hub_encaminhamentos")
      .select("lead_id")
      .gte("encaminhado_em", since),
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
    safeCount(
      supabase
        .from("hub_kpis_resultados")
        .select("id", { count: "exact", head: true })
        .neq("nivel_alerta", "ok")
        .gte("criado_em", since)
    ),
  ]);

  const [alertasRows, mlRows, ciclosRows] = await Promise.all([
    safeSelect(
      supabase
        .from("hub_alertas")
        .select("id, titulo, tipo, criado_em")
        .eq("lido", false)
        .order("criado_em", { ascending: false })
        .limit(5)
    ),
    safeSelect(
      supabase
        .from("hub_ml_observacoes")
        .select("tipo, descricao, amostras")
        .order("criado_em", { ascending: false })
        .limit(5)
    ),
    safeSelect(supabase.from("hub_ciclos_ia").select("ultimo_status").eq("ativo", true)),
  ]);

  const aguardando = await safeCount(
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .or("estagio.is.null,estagio.not.in.(ganho,perdido)")
      .or("humano_responsavel.is.null,humano_responsavel.eq.")
  );

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
  for (const s of FUNIL_LEADS) leadCounts[s.id] = 0;
  for (const r of leadsRes.data ?? []) {
    const e = String((r as { estagio: string | null }).estagio || "novo");
    leadCounts[e] = (leadCounts[e] ?? 0) + 1;
  }

  const negCounts: Record<string, number> = {};
  for (const s of FUNIL_NEGOCIOS) negCounts[s.id] = 0;
  for (const r of negRes.data ?? []) {
    const row = r as { etapa: string; status: string };
    if (!["aberto", "em_negociacao"].includes(row.status)) continue;
    const e = String(row.etapa || "briefing");
    negCounts[e] = (negCounts[e] ?? 0) + 1;
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
    funilLeads: FUNIL_LEADS.map((s) => ({
      id: s.id,
      label: s.short,
      count: leadCounts[s.id] ?? 0,
      color: s.color,
    })),
    funilNegocios: FUNIL_NEGOCIOS.map((s) => ({
      id: s.id,
      label: s.label,
      count: negCounts[s.id] ?? 0,
      color: s.color,
    })),
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
    obras: { emAndamento: obrasAndamento, pedidosAbertos: pedidosAbertos },
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
