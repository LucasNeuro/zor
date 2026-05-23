import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/**
 * Popula hub_kpis_resultados com métricas do funil comercial (doc débito #9).
 * Chamar via cron (Vercel cron / manual POST com x-api-key).
 */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== process.env.INTERNAL_API_KEY?.trim()) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString();
  const now = new Date().toISOString();

  const [totalLeads, qualificados, comNegocio, negociosAbertos, leadsHoje, aprovPend, filaPend] = await Promise.all([
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("estagio", "in", "(novo,perdido)"),
    supabase.from("hub_negocios").select("lead_id", { count: "exact", head: true }).eq("tenant_id", tenantId).not("lead_id", "is", null),
    supabase
      .from("hub_negocios")
      .select("valor_estimado")
      .eq("tenant_id", tenantId)
      .in("status", ["aberto", "em_negociacao"]),
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("criado_em", since),
    supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase
      .from("hub_fila_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("direcao", "entrada")
      .eq("status", "pendente"),
  ]);

  const total = totalLeads.count ?? 0;
  const qual = qualificados.count ?? 0;
  const taxaQual = total > 0 ? (qual / total) * 100 : 0;
  const taxaConv = total > 0 ? ((comNegocio.count ?? 0) / total) * 100 : 0;
  const pipeline = (negociosAbertos.data ?? []).reduce((s, r) => s + Number(r.valor_estimado ?? 0), 0);

  const rows = [
    { kpi_slug: "taxa_qualificacao", valor_medido: taxaQual, valor_meta: 40, nivel_alerta: taxaQual >= 40 ? "ok" : "atencao" },
    { kpi_slug: "taxa_conversao_negocio", valor_medido: taxaConv, valor_meta: 15, nivel_alerta: taxaConv >= 15 ? "ok" : "atencao" },
    { kpi_slug: "pipeline_aberto", valor_medido: pipeline, valor_meta: null, nivel_alerta: "ok" },
    { kpi_slug: "leads_hoje", valor_medido: leadsHoje.count ?? 0, valor_meta: null, nivel_alerta: "ok" },
    { kpi_slug: "aprovacoes_pendentes", valor_medido: aprovPend.count ?? 0, valor_meta: 5, nivel_alerta: (aprovPend.count ?? 0) > 5 ? "critico" : "ok" },
    {
      kpi_slug: "mensagens_fila_pendentes",
      valor_medido: filaPend.count ?? 0,
      valor_meta: 10,
      nivel_alerta: (filaPend.count ?? 0) > 20 ? "critico" : (filaPend.count ?? 0) > 10 ? "atencao" : "ok",
    },
  ].map((r) => ({
    ...r,
    agente_slug: "crm",
    periodo_inicio: since,
    periodo_fim: now,
    tenant_id: tenantId,
  }));

  const slugs = rows.map((r) => r.kpi_slug);
  const { error: delError } = await supabase
    .from("hub_kpis_resultados")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("agente_slug", "crm")
    .in("kpi_slug", slugs)
    .gte("criado_em", since)
    .lte("criado_em", now);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  const { error } = await supabase.from("hub_kpis_resultados").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inseridos: rows.length, metricas: rows });
}
