import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("limit") || 60);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(200, Math.floor(requested)))
    : 60;

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_prompt_logs")
    .select("*")
    .eq("agente_slug", slug)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}
