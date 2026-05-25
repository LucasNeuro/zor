import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

const NEGOCIO_SELECT =
  "id, codigo, titulo, descricao, tipo, prefixo_mercado, lead_id, pessoa_id, empresa_id, pipeline_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, data_previsao_fechamento, data_fechamento, tenant_id, criado_em, atualizado_em";

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  const { data: negocio, error } = await supabase.from("hub_negocios").select(NEGOCIO_SELECT).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const [{ data: atividades }, { data: lead }, { data: pessoa }, { data: propostas }] = await Promise.all([
    supabase.from("hub_atividades").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }).limit(50),
    negocio.lead_id
      ? supabase.from("hub_leads_crm").select("id, nome, telefone, estagio").eq("id", negocio.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    negocio.pessoa_id
      ? supabase.from("hub_pessoas").select("id, codigo, nome, email, telefone").eq("id", negocio.pessoa_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("hub_propostas").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }),
  ]);

  return NextResponse.json({
    data: negocio,
    lead: lead ?? null,
    pessoa: pessoa ?? null,
    timeline: atividades ?? [],
    propostas: propostas ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const allowed = [
    "titulo",
    "descricao",
    "tipo",
    "prefixo_mercado",
    "pessoa_id",
    "empresa_id",
    "lead_id",
    "pipeline_id",
    "valor_estimado",
    "valor_fechado",
    "percentual_comissao",
    "status",
    "etapa",
    "data_previsao_fechamento",
    "data_fechamento",
  ] as const;

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = crmDb();
  const { data, error } = await supabase.from("hub_negocios").update(patch).eq("id", id).select(NEGOCIO_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.etapa || body.status) {
    await supabase.from("hub_atividades").insert({
      negocio_id: id,
      lead_id: data.lead_id,
      tipo: "status_change",
      descricao: `Atualizado: etapa=${data.etapa}, status=${data.status}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantIdFromRequest(request.headers),
    });
  }

  return NextResponse.json({ data });
}
