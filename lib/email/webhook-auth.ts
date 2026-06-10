import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { emailInboundWebhookSecret } from "@/lib/email/resend-config";

/** Nome do query param na URL do webhook inbound de e-mail. */
export function emailWebhookSecretQueryParam(): string {
  return (process.env.EMAIL_INBOUND_WEBHOOK_SECRET_QUERY_PARAM || "eh").trim() || "eh";
}

/** URL pública do webhook inbound; inclui segredo na query quando configurado. */
export function buildPublicEmailInboundWebhookUrl(origin: string, secret?: string | null): string {
  const base = `${origin.replace(/\/+$/, "")}/api/email/inbound`;
  const s = secret?.trim();
  if (!s) return base;
  const qp = emailWebhookSecretQueryParam();
  return `${base}?${encodeURIComponent(qp)}=${encodeURIComponent(s)}`;
}

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

/** Verifica origem do webhook quando EMAIL_INBOUND_WEBHOOK_SECRET está definido. */
export function emailInboundWebhookAutenticado(
  request: NextRequest,
  rawBody: string,
  secret: string
): boolean {
  const sig =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature") ||
    request.headers.get("svix-signature");

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

  const headerName = (
    process.env.EMAIL_INBOUND_WEBHOOK_SECRET_HEADER || "x-email-webhook-secret"
  ).toLowerCase();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === headerName && timingSafeStringEqual((value || "").trim(), secret)) {
      return true;
    }
  }

  const qp = emailWebhookSecretQueryParam().toLowerCase();
  const fromQuery = request.nextUrl.searchParams.get(qp)?.trim();
  if (fromQuery && timingSafeStringEqual(fromQuery, secret)) return true;

  return false;
}

export function resolveEmailInboundWebhookSecret(): string | null {
  return emailInboundWebhookSecret();
}
