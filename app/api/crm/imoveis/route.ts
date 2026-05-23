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
  const busca = searchParams.get("busca") || "";
  const atoParam = searchParams.get("ativo");
  const ativo = atoParam !== "false"; // default true
  const tipo = searchParams.get("tipo") || "";
  const finalidade = searchParams.get("finalidade") || "";
  const status = searchParams.get("status") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_imoveis")
    .select(
      "id, codigo, titulo, tipo, finalidade, status, valor, cidade, estado, dormitorios, area_total_m2, ativo, criado_em",
      { count: "exact" }
    )
    .eq("ativo", ativo)
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq("tipo", tipo);
  if (finalidade) query = query.eq("finalidade", finalidade);
  if (status) query = query.eq("status", status);
  if (busca) {
    query = query.or(
      `titulo.ilike.%${busca}%,cidade.ilike.%${busca}%,bairro.ilike.%${busca}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const supabase = db();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const year = new Date().getFullYear();
  const { count } = await supabase.from("hub_imoveis").select("*", { count: "exact", head: true });
  const codigo = body.codigo || `IMO-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const row = {
    codigo,
    titulo,
    tipo: body.tipo || "apartamento",
    finalidade: body.finalidade || "venda",
    status: body.status || "captacao",
    valor: body.valor != null ? Number(body.valor) : null,
    cidade: body.cidade || null,
    estado: body.estado || null,
    bairro: body.bairro || null,
    dormitorios: body.dormitorios != null ? Number(body.dormitorios) : null,
    area_total_m2: body.area_total_m2 != null ? Number(body.area_total_m2) : null,
    ativo: body.ativo !== false,
  };

  const { data, error } = await supabase.from("hub_imoveis").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
