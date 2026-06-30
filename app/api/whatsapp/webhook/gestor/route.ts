import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { webhookAuthConfig, webhookAutenticado, webhookAuthMismatchHint } from "@/lib/whatsapp/webhook-request-auth";
import { createWhatsappWebhookTrace } from "@/lib/observability/whatsapp-webhook-trace";
import { processarGestorWebhookInbound } from "@/lib/whatsapp/gestor-webhook-inbound";
import { processarWebhookConnectionUazapi } from "@/lib/whatsapp/webhook-connection-handler";
import { parseWhatsappWebhookBody } from "@/lib/whatsapp/webhook-inbound";

let warnedMissingWebhookSecret = false;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "waje-gestor-webhook", version: "1.0" });
}

export async function POST(request: NextRequest) {
  const trace = createWhatsappWebhookTrace(request);
  const { log } = trace;

  try {
    const rawBody = await request.text();
    const { secret, skipVerify, requireSecretInProduction } = webhookAuthConfig();

    if (requireSecretInProduction && !secret) {
      log.error("wa.webhook.gestor.config_missing", { field: "WEBHOOK_SECRET" });
      return trace.json({ error: "Webhook não configurado" }, 500, "config_missing");
    }

    if (secret && !skipVerify) {
      if (!webhookAutenticado(request, rawBody, secret)) {
        log.warn("wa.webhook.gestor.auth_failed", webhookAuthMismatchHint(request, secret));
        return trace.json({ error: "Não autorizado", code: "WEBHOOK_AUTH_FAILED" }, 401, "auth_failed");
      }
      log.info("wa.webhook.gestor.auth_ok");
    } else if (!secret && !skipVerify) {
      if (!warnedMissingWebhookSecret) {
        warnedMissingWebhookSecret = true;
        log.warn("wa.webhook.gestor.auth_disabled");
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return trace.json({ error: "JSON inválido" }, 400, "invalid_json");
    }

    const supabase = db();

    const connection = await processarWebhookConnectionUazapi(supabase, body, "gestor");
    if (connection.handled) {
      log.info("wa.webhook.gestor.connection", {
        updated: connection.updated,
        status: connection.status,
        tenant_id: connection.tenantId ?? null,
        linha_kind: connection.linhaKind,
      });
      return trace.json(
        {
          status: "ok",
          event: "connection",
          updated: connection.updated,
          connection_status: connection.status,
        },
        200,
        "connection_ok"
      );
    }

    const inbound = parseWhatsappWebhookBody(body);
    if (inbound.kind === "ignored") {
      return trace.json({ status: inbound.status }, 200, "parse_ignored");
    }
    if (inbound.kind === "unknown_event") {
      return trace.json({ status: "ignored", event: inbound.event }, 200, "unknown_event");
    }

    const gestorOut = await processarGestorWebhookInbound(supabase, body, log);
    if (gestorOut.handled) {
      return trace.json(gestorOut.body, gestorOut.status, gestorOut.outcome);
    }

    log.warn("wa.webhook.gestor.resolver_ignored", { reason: "not_gestor_instance" });
    return trace.json({ status: "ignored", reason: "not_gestor_instance" }, 200, "resolver_ignored");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("wa.webhook.gestor.unhandled", { error: msg.slice(0, 400) });
    return trace.json({ error: "Erro interno" }, 500, "unhandled");
  }
}
