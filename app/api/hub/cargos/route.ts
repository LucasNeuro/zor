import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  let query = supabase
    .from("hub_cargos_catalogo")
    .select("*")
    .order("segmento")
    .order("especialidade")
    .order("nivel");

  if (!all) query = query.eq("ativo", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("ativo" in body) patch.ativo = !!body.ativo;
  if ("titulo" in body) patch.titulo = String(body.titulo || "").trim() || null;
  if ("segmento" in body) patch.segmento = String(body.segmento || "").trim() || null;
  if ("especialidade" in body) patch.especialidade = String(body.especialidade || "").trim() || null;
  if ("descricao_curta" in body) patch.descricao_curta = String(body.descricao_curta || "").trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_cargos_catalogo")
    .update(patch)
    .eq("slug", slug)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });
  }

  return NextResponse.json(data);
}
