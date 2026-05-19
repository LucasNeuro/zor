import type { NextRequest } from "next/server";
import { createHubLogger } from "@/lib/observability/hub-log";
import { buildPublicWebhookUrl } from "@/lib/whatsapp/webhook-auth";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

/** Filtros UAZAPI: excluir eco da API e grupos (não usar wasNotSentByApi — bloqueia inbound do lead). */
export const UAZAPI_WEBHOOK_EXCLUDE_MESSAGES = ["wasSentByApi", "isGroupYes"] as const;

export function pickPublicAppOrigin(request: NextRequest): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    try {
      const u = new URL(fromEnv);
      const h = u.hostname.toLowerCase();
      if (h !== "localhost" && h !== "127.0.0.1" && h !== "0.0.0.0") {
        u.pathname = "";
        u.search = "";
        u.hash = "";
        return u.toString().replace(/\/+$/, "");
      }
    } catch {
      /* fallthrough */
    }
  }
  try {
    const u = new URL(request.url);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return null;
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function webhookBody(origin: string) {
  return {
    enabled: true,
    url: buildPublicWebhookUrl(origin, process.env.WEBHOOK_SECRET),
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
    return { ok: false, error: "NEXT_PUBLIC_APP_URL ausente/inválido para webhook público" };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/webhook", {
    method: "POST",
    instanceToken,
    body: webhookBody(origin),
  });

  if (!out.ok) {
    createHubLogger("uazapi_webhook_sync").warn("wa.sync.instance_failed", { error: out.error });
    return { ok: false, error: out.error };
  }
  createHubLogger("uazapi_webhook_sync").info("wa.sync.instance_ok", {
    url_host: new URL(String(webhookBody(origin).url)).host,
  });
  return { ok: true };
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
    return { ok: false, error: "NEXT_PUBLIC_APP_URL ausente/inválido para webhook público" };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/globalwebhook", {
    method: "POST",
    admin: true,
    body: webhookBody(origin),
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
  const [instance, global] = await Promise.all([
    syncWebhookDaInstancia(request, instanceToken),
    syncWebhookGlobal(request),
  ]);
  log.info("wa.sync.complete", {
    instance_ok: instance.ok,
    global_ok: global.ok,
    global_skipped: !global.ok && "skipped" in global && global.skipped === true,
  });
  return { instance, global };
}

export function formatWebhookSyncWarnings(sync: Awaited<ReturnType<typeof syncWebhooksUazapi>>): string | undefined {
  const parts: string[] = [];
  if (!sync.instance.ok) parts.push(`instância: ${sync.instance.error}`);
  if (!sync.global.ok && !sync.global.skipped) parts.push(`global: ${sync.global.error}`);
  return parts.length ? parts.join("; ") : undefined;
}
