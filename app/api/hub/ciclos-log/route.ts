import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const agenteSlug = searchParams.get("agente_slug");
  const status = searchParams.get("status");
  const cicloId = searchParams.get("ciclo_id");
  const limitRaw = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 20;

  const supabase = db();
  let query = supabase
    .from("hub_ciclos_log")
    .select("*")
    .order("iniciado_em", { ascending: false })
    .limit(limit);

  if (cicloId) query = query.eq("ciclo_id", cicloId);
  if (agenteSlug) query = query.eq("agente_slug", agenteSlug);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}
