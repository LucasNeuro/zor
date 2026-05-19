import { NextRequest, NextResponse } from "next/server";
import { createHubLogger, maskTelefone } from "@/lib/observability/hub-log";

export type WhatsappWebhookTrace = ReturnType<typeof createWhatsappWebhookTrace>;

export function createWhatsappWebhookTrace(request: NextRequest) {
  const traceId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-render-request-id")?.trim() ||
    undefined;

  const log = createHubLogger("whatsapp_webhook", {}, traceId);
  const t0 = Date.now();

  log.info("wa.webhook.received", {
    method: request.method,
    path: request.nextUrl.pathname,
    has_query_wh: request.nextUrl.searchParams.has("wh"),
    user_agent: request.headers.get("user-agent")?.slice(0, 80) || null,
    content_length: request.headers.get("content-length") || null,
  });

  function withTraceHeaders(res: NextResponse): NextResponse {
    res.headers.set("X-Trace-Id", log.traceId);
    return res;
  }

  function json(
    body: Record<string, unknown>,
    status: number,
    outcome: string,
    extra?: Record<string, unknown>
  ) {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    const payload = {
      http_status: status,
      outcome,
      total_duration_ms: Date.now() - t0,
      ...extra,
    };
    if (level === "error") log.error("wa.webhook.complete", payload);
    else if (level === "warn") log.warn("wa.webhook.complete", payload);
    else log.info("wa.webhook.complete", payload);

    return withTraceHeaders(NextResponse.json({ ...body, trace_id: log.traceId }, { status }));
  }

  return {
    log,
    traceId: log.traceId,
    maskTelefone,
    json,
    withTraceHeaders,
  };
}
