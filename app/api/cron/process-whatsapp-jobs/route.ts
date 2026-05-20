import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { runWhatsappWorkerTick } from "@/lib/workers/whatsapp-job-worker";

/**
 * Processa um lote da fila hub_msg_jobs (fallback quando o Background Worker não está no Render).
 * Chamar a cada 1–5 min via cron (ver scripts/render-dispatch-ciclos.sh).
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runWhatsappWorkerTick();
  return NextResponse.json({
    ok: !result.error,
    claimed: result.claimed,
    worker_id: result.worker_id,
    error: result.error ?? null,
  });
}
