const HTTP_TIMEOUT_MS = 30_000;

export type GmailFetchResult = { ok: boolean; status: number; body: unknown };

export async function gmailFetchJson(
  url: string,
  init: RequestInit
): Promise<GmailFetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* texto */
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

export function bearerTokenFromCredenciais(credenciais: Record<string, unknown> | null | undefined): string {
  if (!credenciais || typeof credenciais !== "object" || Array.isArray(credenciais)) return "";
  const token = credenciais.bearer_token;
  return typeof token === "string" ? token.trim() : "";
}

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf-8");
}

export function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string | null {
  if (!Array.isArray(headers)) return null;
  const target = name.toLowerCase();
  for (const h of headers) {
    if (typeof h.name === "string" && h.name.toLowerCase() === target) {
      return typeof h.value === "string" ? h.value.trim() : null;
    }
  }
  return null;
}

export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const m = part.match(/<([^>]+)>/);
    const addr = (m?.[1] || part).trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(addr)) out.push(addr);
  }
  return out;
}
