import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractWebhookInstanceRefs,
  normalizeWebhookInstanceId,
  parseWhatsappWebhookBody,
} from "@/lib/whatsapp/webhook-inbound";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";
import { processarMensagemGestorWhatsapp } from "@/lib/whatsapp/gestor-whatsapp-processor";
import { checkAndSetWebhookIdempotency } from "@/lib/redis/idempotency";
import { checkTenantRateLimit } from "@/lib/redis/rate-limit";
import { maskTelefone } from "@/lib/observability/hub-log";
import {
  buscarLinhaGestorPorTenant,
  ehGestorChatInternoFromMe,
  resolverTelefoneGestorFromMe,
  telefonesAutorizadosGestor,
} from "@/lib/whatsapp/gestor-linha-db";

export type GestorWebhookLog = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
};

function webhookRateLimitConfig(): { max: number; windowSec: number } | null {
  const maxRaw = process.env.WEBHOOK_RATE_LIMIT_MAX?.trim();
  if (!maxRaw) return null;
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(max) || max <= 0) return null;
  const windowSec = Number.parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_SEC || "60", 10);
  return { max, windowSec: Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 60 };
}

async function aplicarGuardasRedisGestor(
  log: GestorWebhookLog,
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

export type GestorWebhookInboundResult =
  | { handled: false }
  | {
      handled: true;
      status: number;
      body: Record<string, unknown>;
      outcome: string;
    };

async function executarGestorComDedupe(
  log: GestorWebhookLog,
  opts: {
    tenantId: string;
    messageId: string;
    telefone: string;
    pushName?: string | null;
    mensagem: string;
    instanceToken: string;
    supabase: SupabaseClient;
    origem: "inbound" | "from_me";
  }
): Promise<GestorWebhookInboundResult> {
  const messageIdParaGestor = opts.messageId.trim();
  if (messageIdParaGestor) {
    const redisGuard = await aplicarGuardasRedisGestor(log, {
      tenantId: opts.tenantId,
      messageId: messageIdParaGestor,
    });
    if (redisGuard.blocked) {
      return {
        handled: true,
        status: redisGuard.httpStatus ?? 200,
        body: { status: "ignored", reason: redisGuard.reason },
        outcome: redisGuard.reason === "rate_limited" ? "rate_limited" : "duplicate_ignored",
      };
    }
  }

  log.info("wa.webhook.gestor_inbound", {
    telefone: maskTelefone(opts.telefone),
    tenant_id: opts.tenantId,
    origem: opts.origem,
  });

  const gestorOut = await processarMensagemGestorWhatsapp({
    supabase: opts.supabase,
    tenantId: opts.tenantId,
    telefone: opts.telefone,
    pushName: opts.pushName,
    mensagem: opts.mensagem,
    instanceToken: opts.instanceToken,
  });

  if (!gestorOut.ok) {
    log.warn("wa.webhook.gestor_ignored", {
      motivo: gestorOut.motivo ?? null,
      resposta_enviada: gestorOut.respostaEnviada ?? false,
    });
  }

  return {
    handled: true,
    status: 200,
    body: {
      status: gestorOut.ok ? "ok" : "ignored",
      canal: "gestor_whatsapp",
      motivo: gestorOut.motivo ?? null,
      resposta_enviada: gestorOut.respostaEnviada ?? false,
    },
    outcome: gestorOut.ok ? "gestor_ok" : "gestor_ignored",
  };
}

/** fromMe na linha gestor — «mensagens para você» / chat consigo mesmo (não conversa com cliente). */
async function processarGestorWebhookFromMe(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  log: GestorWebhookLog
): Promise<GestorWebhookInboundResult> {
  const inbound = parseWhatsappWebhookBody(body);
  if (inbound.kind !== "outgoing_human") return { handled: false };
  if (inbound.value.isGroup) return { handled: false };

  const outbound = inbound.value;
  const refs = extractWebhookInstanceRefs(body);
  const instanceKey = outbound.instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
  const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
    instanceToken: refs.instanceToken,
    instanceName: refs.instanceName,
    escopo: "gestor",
  });
  if (linhaWa.kind !== "gestor_instance") return { handled: false };

  const linha = await buscarLinhaGestorPorTenant(supabase, linhaWa.tenantId);
  const autorizados = telefonesAutorizadosGestor(linha?.telefones_autorizados);
  if (!ehGestorChatInternoFromMe(outbound.telefone, autorizados)) {
    return { handled: false };
  }

  const telefoneGestor = resolverTelefoneGestorFromMe(outbound.telefone, autorizados);
  if (!telefoneGestor) {
    return {
      handled: true,
      status: 200,
      body: { status: "ignored", reason: "gestor_from_me_sem_telefone_autorizado" },
      outcome: "gestor_from_me_ignored",
    };
  }

  const mensagem = outbound.mensagemFinal.trim();
  if (!mensagem) {
    return {
      handled: true,
      status: 200,
      body: { status: "ignored", reason: "mensagem_vazia" },
      outcome: "gestor_ignored",
    };
  }

  return executarGestorComDedupe(log, {
    supabase,
    tenantId: linhaWa.tenantId,
    messageId: outbound.messageId || "",
    telefone: telefoneGestor,
    pushName: outbound.pushName,
    mensagem,
    instanceToken: linhaWa.instanceToken,
    origem: "from_me",
  });
}

/** Mensagens inbound da linha gestor (menu, agentes internos). */
export async function processarGestorWebhookInbound(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  log: GestorWebhookLog
): Promise<GestorWebhookInboundResult> {
  const fromMe = await processarGestorWebhookFromMe(supabase, body, log);
  if (fromMe.handled) return fromMe;

  const inbound = parseWhatsappWebhookBody(body);
  if (inbound.kind === "ignored" || inbound.kind === "unknown_event" || inbound.kind === "outgoing_human") {
    return { handled: false };
  }

  const { telefone, pushName, messageId, mensagemFinal, instance } = inbound.value;
  if (telefone.length < 10) {
    return {
      handled: true,
      status: 200,
      body: { status: "ignored", reason: "invalid_phone" },
      outcome: "invalid_phone",
    };
  }

  const refs = extractWebhookInstanceRefs(body);
  const instanceKey = instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
  const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
    instanceToken: refs.instanceToken,
    instanceName: refs.instanceName,
    escopo: "gestor",
  });

  if (linhaWa.kind !== "gestor_instance") {
    return { handled: false };
  }

  return executarGestorComDedupe(log, {
    supabase,
    tenantId: linhaWa.tenantId,
    messageId: messageId || "",
    telefone,
    pushName,
    mensagem: mensagemFinal,
    instanceToken: linhaWa.instanceToken,
    origem: "inbound",
  });
}

/** Evento veio da instância gestor (inbound ou fromMe) — evita human_takeover no webhook global. */
export async function eventoEhDaLinhaGestor(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<boolean> {
  const refs = extractWebhookInstanceRefs(body);
  const instanceKey = refs.instanceId ?? normalizeWebhookInstanceId(body);
  const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
    instanceToken: refs.instanceToken,
    instanceName: refs.instanceName,
    escopo: "gestor",
  });
  return linhaWa.kind === "gestor_instance";
}
