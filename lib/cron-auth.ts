import type { NextRequest } from "next/server";

/**
 * Autoriza chamadas aos endpoints de ciclos (cron Vercel, curl manual, dev).
 * Em produção: Vercel Cron ou Bearer/header/query com CRON_SECRET configurado.
 */
export function cronRequestAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  if (request.headers.get("x-vercel-cron") === "1") return true;

  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const qp = request.nextUrl.searchParams.get("secret");
  const hdr = request.headers.get("x-cron-secret");
  if (qp === expected || hdr === expected) return true;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token === expected) return true;
  }

  return false;
}
