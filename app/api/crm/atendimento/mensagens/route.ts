import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const leadId = request.nextUrl.searchParams.get("leadId")?.trim();
    if (!leadId) {
      return NextResponse.json({ error: "leadId é obrigatório", mensagens: [] }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("hub_fila_mensagens")
      .select("*")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: true })
      .limit(250);

    if (error) {
      return NextResponse.json({ error: error.message, mensagens: [] }, { status: 500 });
    }

    const { data: notas, error: notasErr } = await supabase
      .from("hub_notas")
      .select("id, conteudo, criado_por, criado_em")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: true })
      .limit(100);

    if (notasErr) {
      return NextResponse.json({ error: notasErr.message, mensagens: [] }, { status: 500 });
    }

    return NextResponse.json({ mensagens: data ?? [], notas: notas ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, mensagens: [] }, { status: 500 });
  }
}
