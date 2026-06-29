import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { webhookSecretQueryParam } from "@/lib/whatsapp/webhook-auth";

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verifica origem do webhook quando WEBHOOK_SECRET está definido (HMAC ou segredo em header/Bearer). */
export function webhookAutenticado(request: NextRequest, rawBody: string, secret: string): boolean {
  const sig =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature");

  if (sig) {
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    let incoming = sig.trim();
    if (incoming.startsWith("sha256=")) incoming = incoming.slice(7);
    try {
      const a = Buffer.from(incoming, "hex");
      const b = Buffer.from(expectedHex, "hex");
      if (a.length === b.length && a.length > 0) return timingSafeEqual(a, b);
    } catch {
      /* fallthrough */
    }
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (timingSafeStringEqual(token, secret)) return true;
  }

  const headerName = (process.env.WEBHOOK_SECRET_HEADER || "x-webhook-secret").toLowerCase();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === headerName && timingSafeStringEqual((value || "").trim(), secret)) {
      return true;
    }
  }

  const qp = webhookSecretQueryParam().toLowerCase();
  const fromQuery = request.nextUrl.searchParams.get(qp)?.trim();
  if (fromQuery && secretMatches(fromQuery, secret)) return true;

  /** UAZAPI pode enviar o parâmetro com capitalização diferente. */
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (key.toLowerCase() === qp && secretMatches((value || "").trim(), secret)) return true;
  }

  return false;
}

function secretMatches(candidate: string, secret: string): boolean {
  if (!candidate) return false;
  if (timingSafeStringEqual(candidate, secret)) return true;
  try {
    const once = decodeURIComponent(candidate);
    if (once !== candidate && timingSafeStringEqual(once, secret)) return true;
    const twice = decodeURIComponent(once);
    if (twice !== once && timingSafeStringEqual(twice, secret)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function webhookAuthMismatchHint(request: NextRequest, secret: string): Record<string, unknown> {
  const qp = webhookSecretQueryParam().toLowerCase();
  let fromQuery = "";
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (key.toLowerCase() === qp) {
      fromQuery = (value || "").trim();
      break;
    }
  }
  return {
    has_query_wh: Boolean(fromQuery),
    wh_len: fromQuery.length,
    secret_len: secret.length,
    wh_prefix: fromQuery.slice(0, 4) || null,
    secret_prefix: secret.slice(0, 4) || null,
    hint:
      fromQuery && secret && fromQuery.slice(0, 4) !== secret.slice(0, 4)
        ? "Segredo na URL do webhook gestor não coincide com WEBHOOK_SECRET do servidor — sincronize em Canais → WhatsApp interno → Sincronizar recepção (em produção)."
        : "Falha na verificação do webhook gestor.",
  };
}

export function webhookAuthConfig(): {
  secret: string | undefined;
  skipVerify: boolean;
  requireSecretInProduction: boolean;
} {
  const skipVerify =
    process.env.NODE_ENV !== "production" && process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY === "true";
  const secret = process.env.WEBHOOK_SECRET?.trim();
  return {
    secret,
    skipVerify,
    requireSecretInProduction: process.env.NODE_ENV === "production",
  };
}
