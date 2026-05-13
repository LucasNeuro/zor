import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const sinceParam = request.nextUrl.searchParams.get("since");
  const since =
    sinceParam ||
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString();
  const tenantId = tenantIdFromRequest(request.headers);

  const [
    leadsHoje,
    aguardando,
    receitaRow,
    totalLeads,
    qualificados,
    comEncaminhamento,
    aprovs,
    msgs,
    agentes,
    parceiros,
    encaminhamentosHoje,
  ] = await Promise.all([
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("criado_em", since),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .or("estagio.is.null,estagio.not.in.(ganho,perdido)")
      .or("humano_responsavel.is.null,humano_responsavel.eq."),
    supabase
      .from("hub_leads_crm")
      .select("valor_estimado.sum()")
      .eq("tenant_id", tenantId)
      .or("estagio.is.null,estagio.not.in.(ganho,perdido)")
      .maybeSingle(),
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("estagio", "is", null)
      .neq("estagio", "")
      .not("estagio", "in", "(novo,perdido)"),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("encaminhado_para", "is", null)
      .neq("encaminhado_para", ""),
    supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase
      .from("hub_fila_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("direcao", "entrada")
      .eq("status", "pendente"),
    supabase.from("hub_agente_identidade").select("id", { count: "exact", head: true }).eq("ativo", true).eq("tenant_id", tenantId),
    supabase.from("hub_profissionais").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase
      .from("hub_encaminhamentos")
      .select("id", { count: "exact", head: true })
      .gte("encaminhado_em", since),
  ]);

  const err =
    leadsHoje.error ||
    aguardando.error ||
    receitaRow.error ||
    totalLeads.error ||
    qualificados.error ||
    comEncaminhamento.error ||
    aprovs.error ||
    msgs.error ||
    agentes.error ||
    parceiros.error ||
    encaminhamentosHoje.error;

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const total = totalLeads.count ?? 0;
  const sumVal = receitaRow.data as { sum: number | null } | null;
  const receitaPotencial = Number(sumVal?.sum ?? 0);

  const taxaQualificacao = total > 0 ? Math.round(((qualificados.count ?? 0) / total) * 100) : 0;
  const taxaEncaminhamento = total > 0 ? Math.round(((comEncaminhamento.count ?? 0) / total) * 100) : 0;

  return NextResponse.json({
    leadsHoje: leadsHoje.count ?? 0,
    leadsAguardando: aguardando.count ?? 0,
    aprovacoesPendentes: aprovs.count ?? 0,
    conversasAtivas: msgs.count ?? 0,
    agentesAtivos: agentes.count ?? 0,
    receitaPotencial,
    parceirosAtivos: parceiros.count ?? 0,
    encaminhamentosHoje: encaminhamentosHoje.count ?? 0,
    taxaQualificacao,
    taxaEncaminhamento,
  });
}
