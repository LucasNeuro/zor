import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { executarFollowupTodosAgentesAtivos } from "@/lib/hub/followup-runner";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron: follow-up automático WhatsApp por agente (config ativa em hub_agente_followup_config).
 * Agendar a cada 5–15 min com CRON_SECRET (Render ou Vercel).
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = db();
  const { resultados, erros } = await executarFollowupTodosAgentesAtivos(supabase, {
    registrarTick: true,
    fonteTick: "cron",
  });

  const totais = resultados.reduce(
    (acc, r) => {
      acc.enviados += r.enviados;
      acc.arquivados += r.arquivados;
      return acc;
    },
    { enviados: 0, arquivados: 0 }
  );

  return NextResponse.json({
    ok: true,
    tick: new Date().toISOString(),
    agentes_processados: resultados.length,
    ...totais,
    resultados,
    erros,
  });
}

export const POST = GET;
