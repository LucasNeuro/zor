/** Chamadas HTTP à API Resend (https://api.resend.com). */

import { resendApiKey } from "@/lib/email/resend-config";

const RESEND_ORIGIN = "https://api.resend.com";

export function extrairMensagemErroResend(data: unknown, status: number): string {
  if (typeof data === "string") {
    const t = data.trim();
    if (t) return t.length > 600 ? `${t.slice(0, 600)}…` : t;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["message", "error", "detail", "name"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return `HTTP ${status}`;
}

export type ResendJsonResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: T | undefined; error: string };

export async function resendFetchJson<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<ResendJsonResult<T>> {
  const key = resendApiKey();
  if (!key) {
    return { ok: false, status: 0, data: undefined, error: "RESEND_API_KEY não configurado" };
  }

  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${RESEND_ORIGIN}${p}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
    "User-Agent": "escritorio-virtual/1.0",
  };

  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, {
      method: options.method || (bodyStr ? "POST" : "GET"),
      headers,
      body: bodyStr,
    });

    const raw = await res.text();
    let data: T | undefined;
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as T;
      } catch {
        data = raw as unknown as T;
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: extrairMensagemErroResend(data, res.status),
      };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro de rede Resend";
    return { ok: false, status: 0, data: undefined, error: msg };
  }
}
