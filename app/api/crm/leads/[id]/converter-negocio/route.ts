import { NextRequest, NextResponse } from "next/server";
import { gerarCodigoNegocio } from "@/lib/crm/negocio-cadastro";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
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
    .select("id, nome, valor_estimado, pessoa_id, estagio")
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

  const prefixo_mercado = String(body.prefixo_mercado || "IMB").trim() || "IMB";
  const titulo = String(body.titulo || `Negócio — ${lead.nome}`).trim();
  const codigo = await gerarCodigoNegocio(supabase);

  const row = {
    codigo,
    titulo,
    prefixo_mercado,
    lead_id,
    pessoa_id: lead.pessoa_id,
    valor_estimado: lead.valor_estimado ?? 0,
    status: "aberto",
    etapa: "briefing",
    tenant_id: tenantId,
  };

  const { data: negocio, error } = await supabase.from("hub_negocios").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("hub_atividades").insert({
    lead_id,
    negocio_id: negocio.id,
    tipo: "status_change",
    descricao: `Negócio ${codigo} criado a partir do lead`,
    feito_por: "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });

  if (lead.estagio !== "negociando") {
    await supabase
      .from("hub_leads_crm")
      .update({ estagio: "negociando", atualizado_em: new Date().toISOString() })
      .eq("id", lead_id);
  }

  return NextResponse.json({ data: negocio }, { status: 201 });
}
