import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { followupCronShouldRun, followupDispatchMode } from "@/lib/hub/followup-dispatch";
import { executarFollowupTodosAgentesAtivos } from "@/lib/hub/followup-runner";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Cron follow-up WhatsApp (ledger + proximo_followup + faixa horária por agente). Render: a cada 5 min. */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  if (!followupCronShouldRun()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      motivo: `FOLLOWUP_DISPATCH_MODE=${followupDispatchMode()} — cron não dispara follow-up`,
      tick: new Date().toISOString(),
    });
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
      acc.leads_elegiveis += r.leads_elegiveis;
      for (const [k, v] of Object.entries(r.resumo_skip ?? {})) {
        acc.resumo_skip[k] = (acc.resumo_skip[k] ?? 0) + (v ?? 0);
      }
      return acc;
    },
    {
      enviados: 0,
      arquivados: 0,
      leads_elegiveis: 0,
      resumo_skip: {} as Record<string, number>,
    }
  );

  return NextResponse.json({
    ok: true,
    dispatch_mode: followupDispatchMode(),
    tick: new Date().toISOString(),
    agentes_processados: resultados.length,
    ...totais,
    resultados,
    erros,
  });
}

export const POST = GET;
