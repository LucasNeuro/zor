import type { NextRequest } from "next/server";
import { createHubLogger } from "@/lib/observability/hub-log";
import { buildPublicGestorWebhookUrl, buildPublicWebhookUrl } from "@/lib/whatsapp/webhook-auth";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

/** Filtros UAZAPI: excluir eco da API (não usar wasNotSentByApi — bloqueia inbound do lead). */
export const UAZAPI_WEBHOOK_EXCLUDE_MESSAGES = ["wasSentByApi"] as const;

function webhookSyncMode(): "global_only" | "instance_and_global" {
  const raw = process.env.UAZAPI_WEBHOOK_SYNC_MODE?.trim().toLowerCase();
  if (raw === "instance_and_global") return "instance_and_global";
  return "global_only";
}

export function isLocalhostHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
}

function allowLocalhostWebhookOrigin(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.UAZAPI_ALLOW_LOCALHOST_WEBHOOK !== "0"
  );
}

function normalizeOriginUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function originFromForwardedHeaders(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return normalizeOriginUrl(`${proto}://${host}`);
}

function acceptOriginCandidate(raw: string, isProd: boolean): string | null {
  const normalized = normalizeOriginUrl(raw);
  if (!normalized) return null;
  try {
    const h = new URL(normalized).hostname.toLowerCase();
    if (isLocalhostHost(h)) {
      if (isProd) return null;
      if (!allowLocalhostWebhookOrigin()) return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/**
 * White-label: webhook UAZAPI deve ficar num único domínio canónico (ex. waje.com.br),
 * mesmo quando o CRM é acedido por synkronia.com.br ou outro revendedor.
 */
function pinnedWebhookPublicOrigin(isProd: boolean): string | null {
  const raw =
    process.env.WHATSAPP_WEBHOOK_PUBLIC_ORIGIN?.trim() ||
    process.env.WEBHOOK_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  return acceptOriginCandidate(raw, isProd);
}

/**
 * Origem pública para webhook WhatsApp (UAZAPI precisa alcançar esta URL).
 * Com WHATSAPP_WEBHOOK_PUBLIC_ORIGIN fixa o domínio canónico (recomendado em white-label).
 * Caso contrário, em produção prioriza x-forwarded-host e depois env.
 */
export function pickPublicAppOrigin(request: NextRequest): string | null {
  const isProd = process.env.NODE_ENV === "production";

  const pinned = pinnedWebhookPublicOrigin(isProd);
  if (pinned) return pinned;

  if (isProd) {
    const forwarded = originFromForwardedHeaders(request);
    if (forwarded) return forwarded;
  }

  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
  ];
  for (const raw of envCandidates) {
    const accepted = raw?.trim() ? acceptOriginCandidate(raw.trim(), isProd) : null;
    if (accepted) return accepted;
  }

  return acceptOriginCandidate(request.url, isProd);
}

function webhookBodyExterno(origin: string) {
  return {
    enabled: true,
    url: buildPublicWebhookUrl(origin, process.env.WEBHOOK_SECRET),
    events: ["messages", "connection"],
    excludeMessages: [...UAZAPI_WEBHOOK_EXCLUDE_MESSAGES],
    addUrlEvents: false,
    addUrlTypesMessages: false,
  };
}

function webhookBodyGestor(origin: string) {
  return {
    enabled: true,
    url: buildPublicGestorWebhookUrl(origin, process.env.WEBHOOK_SECRET),
    events: ["messages", "connection"],
    excludeMessages: [...UAZAPI_WEBHOOK_EXCLUDE_MESSAGES],
    addUrlEvents: false,
    addUrlTypesMessages: false,
  };
}

export async function syncWebhookDaInstancia(
  request: NextRequest,
  instanceToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin = pickPublicAppOrigin(request);
  if (!origin) {
    return {
      ok: false,
      error:
        "URL pública indisponível. Defina NEXT_PUBLIC_APP_URL=https://waje.com.br no Render (sem localhost).",
    };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/webhook", {
    method: "POST",
    instanceToken,
    body: webhookBodyExterno(origin),
  });

  if (!out.ok) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.instance_failed", { error: out.error });
    return { ok: false, error: out.error };
  }
  createHubLogger("uazapi_webhook_sync").info("wa.sync.instance_ok", {
    url_host: new URL(String(webhookBodyExterno(origin).url)).host,
  });
  return { ok: true };
}

/** Webhook por instância — linha interna gestor (não altera webhook global). */
export async function syncWebhookGestorDaInstancia(
  request: NextRequest,
  instanceToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin = pickPublicAppOrigin(request);
  if (!origin) {
    return {
      ok: false,
      error:
        "URL pública indisponível. Defina NEXT_PUBLIC_APP_URL=https://waje.com.br no Render (sem localhost).",
    };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/webhook", {
    method: "POST",
    instanceToken,
    body: webhookBodyGestor(origin),
  });

  if (!out.ok) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.gestor_instance_failed", { error: out.error });
    return { ok: false, error: out.error };
  }
  createHubLogger("uazapi_webhook_sync").info("wa.sync.gestor_instance_ok", {
    url_host: new URL(String(webhookBodyGestor(origin).url)).host,
  });
  return { ok: true };
}

export async function syncWebhooksUazapiGestor(
  request: NextRequest,
  instanceToken: string
): Promise<{ instance: { ok: true } | { ok: false; error: string } }> {
  const instance = await syncWebhookGestorDaInstancia(request, instanceToken);
  createHubLogger("uazapi_webhook_sync").info("wa.sync.gestor_complete", { instance_ok: instance.ok });
  return { instance };
}

export function publicGestorWebhookUrlFromRequest(request: NextRequest): string | null {
  const origin = pickPublicAppOrigin(request);
  if (!origin) return null;
  return buildPublicGestorWebhookUrl(origin, process.env.WEBHOOK_SECRET);
}

export function formatGestorWebhookSyncWarnings(
  sync: Awaited<ReturnType<typeof syncWebhooksUazapiGestor>>
): string | undefined {
  if (sync.instance.ok) return undefined;
  return `instância gestor: ${sync.instance.error}`;
}

async function disableWebhookDaInstancia(
  request: NextRequest,
  instanceToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin = pickPublicAppOrigin(request);
  if (!origin) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL ausente/inválido para webhook público" };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/webhook", {
    method: "POST",
    instanceToken,
    body: { enabled: false, url: buildPublicWebhookUrl(origin, process.env.WEBHOOK_SECRET) },
  });

  if (!out.ok) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.instance_disable_failed", { error: out.error });
    return { ok: false, error: out.error };
  }
  createHubLogger("uazapi_webhook_sync").info("wa.sync.instance_disabled");
  return { ok: true };
}

export function shouldSyncGlobalWebhookToOrigin(origin: string): boolean {
  try {
    if (isLocalhostHost(new URL(origin).hostname)) {
      return process.env.UAZAPI_ALLOW_LOCALHOST_GLOBAL_WEBHOOK === "1";
    }
    return true;
  } catch {
    return false;
  }
}

/** Webhook global (todas as instâncias) — requer UAZAPI_ADMIN_TOKEN no servidor. */
export async function syncWebhookGlobal(
  request: NextRequest
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  if (!process.env.UAZAPI_ADMIN_TOKEN?.trim()) {
    return { ok: false, error: "UAZAPI_ADMIN_TOKEN não configurado", skipped: true };
  }

  const origin = pickPublicAppOrigin(request);
  if (!origin) {
    return {
      ok: false,
      error:
        "URL pública indisponível. Defina NEXT_PUBLIC_APP_URL=https://waje.com.br no Render (sem localhost).",
    };
  }

  if (!shouldSyncGlobalWebhookToOrigin(origin)) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.global_skipped_localhost", { origin });
    return {
      ok: false,
      skipped: true,
      error:
        "Webhook global não foi alterado (origem localhost derrubaria produção). Abra https://waje.com.br e use «Actualizar estado» no agente.",
    };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/globalwebhook", {
    method: "POST",
    admin: true,
    body: webhookBodyExterno(origin),
  });

  if (!out.ok) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.global_failed", { error: out.error });
    return { ok: false, error: out.error };
  }
  createHubLogger("uazapi_webhook_sync").info("wa.sync.global_ok");
  return { ok: true };
}

export async function syncWebhooksUazapi(
  request: NextRequest,
  instanceToken: string
): Promise<{
  instance: { ok: true } | { ok: false; error: string };
  global: { ok: true } | { ok: false; error: string; skipped?: boolean };
}> {
  const log = createHubLogger("uazapi_webhook_sync");
  const mode = webhookSyncMode();

  let instance: { ok: true } | { ok: false; error: string };
  let global: { ok: true } | { ok: false; error: string; skipped?: boolean };

  if (mode === "global_only") {
    global = await syncWebhookGlobal(request);
    if (global.ok) {
      instance = await disableWebhookDaInstancia(request, instanceToken);
    } else if (!global.ok && "skipped" in global && global.skipped === true) {
      instance = await syncWebhookDaInstancia(request, instanceToken);
    } else {
      instance = await syncWebhookDaInstancia(request, instanceToken);
    }
  } else {
    [instance, global] = await Promise.all([
      syncWebhookDaInstancia(request, instanceToken),
      syncWebhookGlobal(request),
    ]);
  }
  log.info("wa.sync.complete", {
    mode,
    instance_ok: instance.ok,
    global_ok: global.ok,
    global_skipped: !global.ok && "skipped" in global && global.skipped === true,
  });
  return { instance, global };
}

/** URL pública para colar no painel UAZAPI (global ou instância). */
export function publicWebhookUrlFromRequest(request: NextRequest): string | null {
  const origin = pickPublicAppOrigin(request);
  if (!origin) return null;
  return buildPublicWebhookUrl(origin, process.env.WEBHOOK_SECRET);
}

export function maskWebhookUrlForUi(url: string): string {
  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret || !url.includes(secret)) return url;
  return url.replace(secret, `${secret.slice(0, 4)}…`);
}

export function isWebhookUrlLocalhost(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    return isLocalhostHost(new URL(url.trim()).hostname);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function formatWebhookSyncWarnings(sync: Awaited<ReturnType<typeof syncWebhooksUazapi>>): string | undefined {
  const parts: string[] = [];
  if (!sync.instance.ok) parts.push(`instância: ${sync.instance.error}`);
  if (!sync.global.ok && !sync.global.skipped) parts.push(`global: ${sync.global.error}`);
  return parts.length ? parts.join("; ") : undefined;
}
