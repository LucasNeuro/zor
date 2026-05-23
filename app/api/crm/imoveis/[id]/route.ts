import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.titulo != null) updates.titulo = String(body.titulo).trim();
  if (body.tipo != null) updates.tipo = body.tipo;
  if (body.finalidade != null) updates.finalidade = body.finalidade;
  if (body.status != null) updates.status = body.status;
  if (body.cidade != null) updates.cidade = body.cidade;
  if (body.estado != null) updates.estado = body.estado;
  if (body.bairro != null) updates.bairro = body.bairro;
  if (body.valor != null) updates.valor = Number(body.valor);
  if (typeof body.ativo === "boolean") updates.ativo = body.ativo;
  if (body.dormitorios != null) updates.dormitorios = Number(body.dormitorios);
  if (body.area_total_m2 != null) updates.area_total_m2 = Number(body.area_total_m2);

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("hub_imoveis")
    .update(updates)
    .eq("id", id)
    .select("id, codigo, titulo, tipo, finalidade, status, valor, cidade, estado, ativo")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}
