import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractWebhookInstanceRefs,
  normalizeWebhookInstanceId,
  parseWhatsappWebhookBody,
} from "@/lib/whatsapp/webhook-inbound";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";
import { processarMensagemGestorWhatsapp } from "@/lib/whatsapp/gestor-whatsapp-processor";
import { processarWebhookConnectionUazapi } from "@/lib/whatsapp/webhook-connection-handler";
import { webhookAuthConfig, webhookAutenticado } from "@/lib/whatsapp/webhook-request-auth";
import { createWhatsappWebhookTrace } from "@/lib/observability/whatsapp-webhook-trace";
import { checkAndSetWebhookIdempotency } from "@/lib/redis/idempotency";
import { checkTenantRateLimit } from "@/lib/redis/rate-limit";

let warnedMissingWebhookSecret = false;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function webhookRateLimitConfig(): { max: number; windowSec: number } | null {
  const maxRaw = process.env.WEBHOOK_RATE_LIMIT_MAX?.trim();
  if (!maxRaw) return null;
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(max) || max <= 0) return null;
  const windowSec = Number.parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_SEC || "60", 10);
  return { max, windowSec: Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 60 };
}

async function aplicarGuardasRedisWebhook(
  log: { info: (e: string, f?: Record<string, unknown>) => void; warn: (e: string, f?: Record<string, unknown>) => void },
  opts: { tenantId: string; messageId: string }
): Promise<{ blocked: true; reason: string; httpStatus?: number } | { blocked: false }> {
  const messageId = opts.messageId.trim();
  if (!messageId) return { blocked: false };

  try {
    const duplicate = await checkAndSetWebhookIdempotency(opts.tenantId, messageId);
    if (duplicate) {
      log.info("wa.webhook.gestor.duplicate_ignored_redis", {
        message_id: messageId,
        tenant_id: opts.tenantId,
      });
      return { blocked: true, reason: "duplicate_message_id_redis" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn("wa.webhook.gestor.redis_idempotency_failed", { error: msg.slice(0, 200) });
  }

  const rateCfg = webhookRateLimitConfig();
  if (rateCfg) {
    try {
      const rate = await checkTenantRateLimit(
        opts.tenantId,
        "whatsapp_webhook_gestor",
        rateCfg.max,
        rateCfg.windowSec
      );
      if (rate.limited) {
        return { blocked: true, reason: "rate_limited", httpStatus: 429 };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("wa.webhook.gestor.redis_rate_limit_failed", { error: msg.slice(0, 200) });
    }
  }

  return { blocked: false };
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
        return trace.json({ error: "Não autorizado", code: "WEBHOOK_AUTH_FAILED" }, 401, "auth_failed");
      }
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
    if (inbound.kind === "outgoing_human") {
      return trace.json({ status: "ignored", reason: "outgoing_not_handled_gestor" }, 200, "outgoing_ignored");
    }

    const {
      telefone,
      pushName,
      messageId,
      mensagemFinal,
      instance,
    } = inbound.value;

    if (telefone.length < 10) {
      return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
    }

    const refs = extractWebhookInstanceRefs(body);
    const instanceKey = instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
    const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
      instanceToken: refs.instanceToken,
      instanceName: refs.instanceName,
      escopo: "gestor",
    });

    if (linhaWa.kind !== "gestor_instance") {
      log.warn("wa.webhook.gestor.resolver_ignored", {
        kind: linhaWa.kind,
        reason: linhaWa.kind === "ignored" ? linhaWa.reason : linhaWa.kind,
      });
      return trace.json(
        { status: "ignored", reason: linhaWa.kind === "ignored" ? linhaWa.reason : "not_gestor_instance" },
        200,
        "resolver_ignored"
      );
    }

    const messageIdParaGestor = (messageId || "").trim();
    if (messageIdParaGestor) {
      const redisGuard = await aplicarGuardasRedisWebhook(log, {
        tenantId: linhaWa.tenantId,
        messageId: messageIdParaGestor,
      });
      if (redisGuard.blocked) {
        return trace.json(
          { status: "ignored", reason: redisGuard.reason },
          redisGuard.httpStatus ?? 200,
          redisGuard.reason === "rate_limited" ? "rate_limited" : "duplicate_ignored"
        );
      }
    }

    log.info("wa.webhook.gestor_inbound", {
      telefone: trace.maskTelefone(telefone),
      tenant_id: linhaWa.tenantId,
    });

    const gestorOut = await processarMensagemGestorWhatsapp({
      supabase,
      tenantId: linhaWa.tenantId,
      telefone,
      pushName,
      mensagem: mensagemFinal,
      instanceToken: linhaWa.instanceToken,
    });

    return trace.json(
      {
        status: gestorOut.ok ? "ok" : "ignored",
        canal: "gestor_whatsapp",
        motivo: gestorOut.motivo ?? null,
        resposta_enviada: gestorOut.respostaEnviada ?? false,
      },
      200,
      gestorOut.ok ? "gestor_ok" : "gestor_ignored"
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("wa.webhook.gestor.unhandled", { error: msg.slice(0, 400) });
    return trace.json({ error: "Erro interno" }, 500, "unhandled");
  }
}
