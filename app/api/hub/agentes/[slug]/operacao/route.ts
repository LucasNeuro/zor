import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const [ciclosR, logsR, acoesR, promptR] = await Promise.all([
    supabase
      .from("hub_ciclos_ia")
      .select("id, nome, descricao, tipo, ativo, cron_expressao, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos")
      .eq("agente_slug", slug)
      .order("nome"),
    supabase
      .from("hub_ciclos_log")
      .select("id, ciclo_id, status, erro, iniciado_em, finalizado_em, tokens_usados, custo_brl, acoes_tomadas")
      .eq("agente_slug", slug)
      .order("iniciado_em", { ascending: false })
      .limit(25),
    supabase
      .from("hub_acoes_ia")
      .select("id, tipo, descricao, lead_id, sucesso, criado_em, metadata")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(12),
    supabase
      .from("hub_prompt_logs")
      .select("criado_em")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const errors = [ciclosR.error, logsR.error, acoesR.error, promptR.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map((e) => e?.message).join("; ") }, { status: 500 });
  }

  return NextResponse.json({
    ciclos: ciclosR.data || [],
    execucoes_ciclo: logsR.data || [],
    acoes: acoesR.data || [],
    ultimo_prompt_em: promptR.data?.criado_em ?? null,
  });
}
