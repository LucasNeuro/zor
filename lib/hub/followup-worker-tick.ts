import type { SupabaseClient } from "@supabase/supabase-js";
import { createHubLogger } from "@/lib/observability/hub-log";
import { executarFollowupTodosAgentesAtivos } from "@/lib/hub/followup-runner";

export function followupPollMs(): number {
  const raw = Number.parseInt(String(process.env.FOLLOWUP_POLL_MS || ""), 10);
  if (!Number.isFinite(raw)) return 60_000;
  return Math.max(30_000, Math.min(600_000, raw));
}

export function followupWorkerEnabled(): boolean {
  const v = (process.env.FOLLOWUP_WORKER_ENABLED ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/** Tick de follow-up (worker ou cron interno). */
export async function runFollowupTick(supabase: SupabaseClient): Promise<{
  ok: boolean;
  enviados: number;
  arquivados: number;
  agentes: number;
  erros: string[];
}> {
  const log = createHubLogger("followup_worker", { mode: "tick" });
  try {
    const { resultados, erros } = await executarFollowupTodosAgentesAtivos(supabase);
    const enviados = resultados.reduce((n, r) => n + r.enviados, 0);
    const arquivados = resultados.reduce((n, r) => n + r.arquivados, 0);
    if (enviados > 0 || arquivados > 0 || erros.length > 0) {
      log.info("followup.tick", {
        agentes: resultados.length,
        enviados,
        arquivados,
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
