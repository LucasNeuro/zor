import type { SupabaseClient } from "@supabase/supabase-js";
import { executarAgendaLembreteTodosAgentesAtivos } from "@/lib/hub/agenda-lembrete-runner";
import { createHubLogger } from "@/lib/observability/hub-log";
import { executarFollowupTodosAgentesAtivos } from "@/lib/hub/followup-runner";
import { followupDispatchMode } from "@/lib/hub/followup-dispatch";

export { followupWorkerEnabledFlag as followupWorkerEnabled, followupWorkerShouldRun } from "@/lib/hub/followup-dispatch";

export function followupPollMs(): number {
  const raw = Number.parseInt(String(process.env.FOLLOWUP_POLL_MS || ""), 10);
  if (!Number.isFinite(raw)) return 60_000;
  return Math.max(30_000, Math.min(600_000, raw));
}

/** Tick de follow-up (worker). Respeita FOLLOWUP_DISPATCH_MODE. */
export async function runFollowupTick(supabase: SupabaseClient): Promise<{
  ok: boolean;
  enviados: number;
  arquivados: number;
  agentes: number;
  erros: string[];
  skipped?: boolean;
}> {
  const log = createHubLogger("followup_worker", {
    mode: "tick",
    dispatch_mode: followupDispatchMode(),
  });
  try {
    const { resultados, erros } = await executarFollowupTodosAgentesAtivos(supabase, {
      registrarTick: true,
      fonteTick: "worker",
    });
    const enviados = resultados.reduce((n, r) => n + r.enviados, 0);
    const arquivados = resultados.reduce((n, r) => n + r.arquivados, 0);
    const resumoSkip = resultados.reduce<Record<string, number>>((acc, r) => {
      for (const [k, v] of Object.entries(r.resumo_skip ?? {})) {
        acc[k] = (acc[k] ?? 0) + (v ?? 0);
      }
      return acc;
    }, {});

    if (enviados > 0 || arquivados > 0 || erros.length > 0) {
      log.info("followup.tick", {
        agentes: resultados.length,
        enviados,
        arquivados,
        resumo_skip: resumoSkip,
        erros: erros.slice(0, 5),
      });
    }
    return {
      ok: true,
      enviados,
      arquivados,
      agentes: resultados.length,
      erros,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("followup.tick_error", { error: msg.slice(0, 260) });
    return { ok: false, enviados: 0, arquivados: 0, agentes: 0, erros: [msg] };
  }
}

/** Tick de lembretes de agenda (mesmo worker que follow-up). */
export async function runAgendaLembreteTick(supabase: SupabaseClient): Promise<{
  ok: boolean;
  enviados: number;
  agentes: number;
  erros: string[];
}> {
  const log = createHubLogger("agenda_lembrete_worker", { mode: "tick" });
  try {
    const { resultados, erros } = await executarAgendaLembreteTodosAgentesAtivos(supabase);
    const enviados = resultados.reduce((n, r) => n + r.enviados, 0);
    if (enviados > 0 || erros.length > 0) {
      log.info("agenda_lembrete.tick", {
        agentes: resultados.length,
        enviados,
        erros: erros.slice(0, 5),
      });
    }
    return { ok: true, enviados, agentes: resultados.length, erros };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("agenda_lembrete.tick_error", { error: msg.slice(0, 260) });
    return { ok: false, enviados: 0, agentes: 0, erros: [msg] };
  }
}
