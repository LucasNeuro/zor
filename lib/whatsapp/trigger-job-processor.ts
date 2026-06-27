/**
 * Dispara processamento da fila hub_msg_jobs no próprio web service (Render).
 * Necessário quando o Background Worker whatsapp-job-worker não está ativo.
 */
import { runWhatsappWorkerTick } from "@/lib/workers/whatsapp-job-worker";

type WorkerLog = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
};

/** Re-tenta claim quando o 1.º tick não apanhou job (race com commit ou lock por telefone). */
export function agendarRetryWorkerWhatsapp(
  log: WorkerLog,
  delaysMs: number[] = [2500, 7000]
): void {
  void (async () => {
    for (const delay of delaysMs) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const result = await runWhatsappWorkerTick();
        log.info("wa.webhook.job_processor_retry", {
          delay_ms: delay,
          claimed: result.claimed,
          error: result.error ?? null,
        });
        if (result.claimed > 0) return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.warn("wa.webhook.job_processor_retry_failed", {
          delay_ms: delay,
          error: msg.slice(0, 200),
        });
      }
    }
  })();
}

export function dispararProcessamentoJobsWhatsapp(log?: WorkerLog): void {
  const secret = process.env.CRON_SECRET?.trim();
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "").replace(/\/+$/, "");
  if (!secret || !base) {
    log?.warn("wa.webhook.job_processor_skip", {
      reason: !secret ? "cron_secret_ausente" : "app_url_ausente",
    });
    return;
  }

  const url = `${base.startsWith("http") ? base : `https://${base}`}/api/cron/process-whatsapp-jobs`;
  const controller = new AbortController();
  const timeoutMs = Number.parseInt(process.env.WHATSAPP_JOB_TRIGGER_TIMEOUT_MS || "120000", 10);
  const timer = setTimeout(() => controller.abort(), Math.max(15_000, timeoutMs));

  void fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timer);
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
      if (!res.ok) {
        log?.warn("wa.webhook.job_processor_http_error", {
          status: res.status,
          body: JSON.stringify(body).slice(0, 200),
        });
        return;
      }
      log?.info("wa.webhook.job_processor_triggered", {
        claimed: body.claimed ?? null,
        ok: body.ok ?? null,
      });
    })
    .catch((e) => {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      log?.warn("wa.webhook.job_processor_trigger_failed", { error: msg.slice(0, 200) });
    });
}
