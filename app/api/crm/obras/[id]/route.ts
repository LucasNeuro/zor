import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  const { data: obra, error } = await supabase.from("hub_obras").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!obra) return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });

  const [{ data: cronograma }, { data: diario }, { data: checkins }, { data: pedidos }, { data: ocorrencias }] =
    await Promise.all([
      supabase.from("hub_obras_cronograma").select("*").eq("obra_id", id).order("data_prevista"),
      supabase.from("hub_obras_diario").select("*").eq("obra_id", id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("hub_operarios_checkin").select("*").eq("obra_id", id).order("criado_em", { ascending: false }).limit(30),
      supabase.from("hub_pedidos_material").select("*").eq("obra_id", id).order("criado_em", { ascending: false }),
      supabase.from("hub_obras_ocorrencias").select("*").eq("obra_id", id).order("criado_em", { ascending: false }).limit(20),
    ]);

  return NextResponse.json({
    data: obra,
    cronograma: cronograma ?? [],
    diario: diario ?? [],
    checkins: checkins ?? [],
    pedidos: pedidos ?? [],
    ocorrencias: ocorrencias ?? [],
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

  const allowed = ["titulo", "status", "endereco", "cidade", "estado", "data_inicio", "data_previsao_fim"] as const;
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await crmDb().from("hub_obras").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
