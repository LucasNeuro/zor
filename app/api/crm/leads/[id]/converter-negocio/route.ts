import { NextRequest, NextResponse } from "next/server";
import { buildLeadEstagioPatch } from "@/lib/crm/estagio-map";
import { gerarCodigoNegocio } from "@/lib/crm/negocio-cadastro";
import {
  criarVinculosNegocioFromLead,
  prefixoMercadoFromLead,
} from "@/lib/crm/negocio-vinculos";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { listTenantPipelines } from "@/lib/crm/tenant-pipelines";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: lead_id } = await params;
  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, codigo, nome, valor_estimado, pessoa_id, estagio, metadata, pipeline_id")
    .eq("id", lead_id)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    /* empty body ok */
  }

  const prefixo_mercado =
    String(body.prefixo_mercado || prefixoMercadoFromLead(lead.metadata) || "GRL").trim() || "GRL";
  const titulo = String(body.titulo || `Negócio — ${lead.nome}`).trim();
  const codigo = await gerarCodigoNegocio(supabase);

  let pipelineNegId: string | null = null;
  try {
    const pipelines = await listTenantPipelines(supabase, tenantId, "negocio");
    pipelineNegId = pipelines[0]?.id ?? null;
  } catch {
    /* fallback abaixo */
  }

  if (!pipelineNegId) {
    const { data: pipeNeg } = await supabase
      .from("hub_pipelines")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tipo", "negocio")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pipeNeg?.id) pipelineNegId = String(pipeNeg.id);
  }

  let pessoaCodigo: string | null = null;
  let empresaId: string | null = null;
  let empresaCodigo: string | null = null;

  if (lead.pessoa_id) {
    const { data: pes } = await supabase
      .from("hub_pessoas")
      .select("id, codigo, empresa_id, tipo_pessoa")
      .eq("id", lead.pessoa_id)
      .maybeSingle();
    if (pes) {
      pessoaCodigo = pes.codigo != null ? String(pes.codigo) : null;
      if (pes.empresa_id) {
        empresaId = String(pes.empresa_id);
        const { data: emp } = await supabase
          .from("hub_empresas")
          .select("codigo")
          .eq("id", empresaId)
          .maybeSingle();
        empresaCodigo = emp?.codigo != null ? String(emp.codigo) : null;
      }
    }
  }

  const row = {
    codigo,
    titulo,
    prefixo_mercado,
    lead_id,
    pessoa_id: lead.pessoa_id,
    empresa_id: empresaId,
    valor_estimado: lead.valor_estimado ?? 0,
    status: "aberto",
    etapa: "novo",
    pipeline_id: pipelineNegId,
    tenant_id: tenantId,
  };

  const { data: negocio, error } = await supabase.from("hub_negocios").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await criarVinculosNegocioFromLead(supabase, {
      negocio_id: negocio.id,
      lead_id,
      lead_codigo: lead.codigo != null ? String(lead.codigo) : null,
      pessoa_id: lead.pessoa_id != null ? String(lead.pessoa_id) : null,
      pessoa_codigo: pessoaCodigo,
      empresa_id: empresaId,
      empresa_codigo: empresaCodigo,
      tenant_id: tenantId,
    });
  } catch (vincErr) {
    const msg = vincErr instanceof Error ? vincErr.message : String(vincErr);
    if (!msg.includes("does not exist")) {
      return NextResponse.json(
        { error: `Negócio criado, mas vínculos falharam: ${msg}`, data: negocio },
        { status: 207 }
      );
    }
  }

  await supabase.from("hub_atividades").insert({
    lead_id,
    negocio_id: negocio.id,
    tipo: "status_change",
    descricao: `Negócio ${codigo} criado (LED ${lead.codigo || lead_id.slice(0, 8)}${pessoaCodigo ? ` · PES ${pessoaCodigo}` : ""})`,
    feito_por: "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });

  await supabase
    .from("hub_leads_crm")
    .update({
      ...buildLeadEstagioPatch("ganho"),
      negocio_id: negocio.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", lead_id);

  return NextResponse.json({ data: negocio }, { status: 201 });
}
