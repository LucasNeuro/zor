import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { HubFollowupConfigLite } from "@/lib/hub-ciclos-configuracoes";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_followup_config")
    .select("passo, mercado, horas_espera")
    .eq("ativo", true)
    .order("mercado", { ascending: true })
    .order("passo", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: HubFollowupConfigLite[] = (data || []).map((r) => ({
    passo: typeof r.passo === "number" ? r.passo : Number.parseInt(String(r.passo), 10),
    mercado: String(r.mercado ?? "geral"),
    horas_espera:
      typeof r.horas_espera === "number"
        ? r.horas_espera
        : Number.parseInt(String(r.horas_espera ?? "0"), 10) || 0,
  }));

  return NextResponse.json({ rows });
}

export async function PATCH(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    updates?: { passo: number; mercado: string; horas_espera: number }[];
  };

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates[] obrigatório" }, { status: 400 });
  }

  const supabase = db();
  for (const u of updates) {
    const { error } = await supabase
      .from("hub_followup_config")
      .update({ horas_espera: u.horas_espera })
      .eq("passo", u.passo)
      .eq("mercado", u.mercado)
      .eq("ativo", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return GET();
}
