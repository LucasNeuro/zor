/**
 * Quem dispara follow-up: cron Render, worker WhatsApp ou ambos (ledger evita reenvio).
 *
 * Render (produção): FOLLOWUP_DISPATCH_MODE=cron + schedule a cada 5 min
 * Testes cadência curta: FOLLOWUP_DISPATCH_MODE=worker + FOLLOWUP_POLL_MS=60000
 */

export type FollowupDispatchMode = "cron" | "worker" | "both";

export function followupDispatchMode(): FollowupDispatchMode {
  const v = (process.env.FOLLOWUP_DISPATCH_MODE ?? "cron").trim().toLowerCase();
  if (v === "worker" || v === "both") return v;
  return "cron";
}

export function followupWorkerEnabledFlag(): boolean {
  const v = (process.env.FOLLOWUP_WORKER_ENABLED ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/** Worker deve executar tick de follow-up neste processo. */
export function followupWorkerShouldRun(): boolean {
  if (!followupWorkerEnabledFlag()) return false;
  const mode = followupDispatchMode();
  return mode === "worker" || mode === "both";
}

/** Cron Render deve chamar /api/cron/followup-whatsapp. */
export function followupCronShouldRun(): boolean {
  const skip = (process.env.DISPATCH_FOLLOWUP_ENABLED ?? "1").trim().toLowerCase();
  if (skip === "0" || skip === "false" || skip === "off" || skip === "no") {
    return false;
  }
  const mode = followupDispatchMode();
  return mode === "cron" || mode === "both";
}

/** Intervalo recomendado do cron (minutos) — alinhado a proximo_followup. */
export function followupCronScheduleHint(): string {
  return (process.env.FOLLOWUP_CRON_SCHEDULE ?? "*/5 * * * *").trim() || "*/5 * * * *";
}
