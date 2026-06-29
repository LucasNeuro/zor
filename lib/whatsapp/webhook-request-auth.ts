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
  if (fromQuery && timingSafeStringEqual(fromQuery, secret)) return true;

  return false;
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
