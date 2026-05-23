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
  const status = searchParams.get("status") || "pendente";

  const query = db()
    .from("hub_aprovacoes")
    .select("*")
    .eq("status", status)
    .order("criado_em", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const aprovacoes = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    descricao: row.descricao ?? row.titulo ?? "Aprovação",
    motivo: row.motivo ?? row.descricao ?? "",
    agente_slug: row.agente_slug ?? row.solicitado_por ?? "sdr",
    agente_nome: row.agente_nome ?? row.agente_slug ?? "IA",
    confianca_ia: row.confianca_ia ?? 85,
    valor_envolvido: row.valor_envolvido ?? row.valor ?? 0,
  }));

  return NextResponse.json({ aprovacoes });
}
