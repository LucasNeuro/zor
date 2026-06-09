import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: lead_id } = await params;
  let body: { conteudo?: string; criado_por?: string };
  try {
    body = (await request.json()) as { conteudo?: string; criado_por?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const conteudo = String(body.conteudo ?? "").trim();
  if (!conteudo) {
    return NextResponse.json({ error: "Conteúdo da observação é obrigatório." }, { status: 400 });
  }

  const supabase = crmDb();
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, tenant_id")
    .eq("id", lead_id)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const tenantId =
    (lead.tenant_id as string | null) ||
    tenantIdFromRequest(request.headers) ||
    defaultTenantId();

  const criadoPor = String(body.criado_por ?? "humano").trim() || "humano";

  const { data: nota, error: notaErr } = await supabase
    .from("hub_notas")
    .insert({
      lead_id,
      conteudo,
      criado_por: criadoPor,
      tenant_id: tenantId,
    })
    .select("id, conteudo, criado_por, criado_em")
    .single();

  if (notaErr) {
    return NextResponse.json({ error: notaErr.message }, { status: 500 });
  }

  await supabase.from("hub_atividades").insert({
    lead_id,
    tipo: "nota",
    descricao: conteudo.slice(0, 80),
    feito_por: criadoPor,
    feito_por_tipo: "humano",
    tenant_id: tenantId,
    metadata: { interno: true, visivel_cliente: false },
  });

  return NextResponse.json({ data: nota }, { status: 201 });
}
