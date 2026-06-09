import { uazapiBaseUrlNormalizado } from "@/lib/whatsapp/uazapi-http";

export type UazapiSendTextResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

/**
 * POST /send/text — header `token` = token da instância (não o admin).
 * @see docs/uazapi-openapi-spec
 */
export async function uazapiSendText(
  numero: string,
  text: string,
  instanceToken?: string | null
): Promise<UazapiSendTextResult> {
  const base = uazapiBaseUrlNormalizado();
  const token = (instanceToken?.trim() || process.env.UAZAPI_INSTANCE_TOKEN?.trim()) ?? "";

  if (!base || !token) {
    return {
      ok: false,
      error: "UAZAPI_BASE_URL ou token da instância não configurados (instância do agente ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const url = `${base}/send/text`;
  const raw = numero.trim();
  const number =
    raw.includes("@g.us") ||
    raw.includes("@s.whatsapp.net") ||
    raw.includes("@lid") ||
    raw.includes("@newsletter")
      ? raw
      : raw.replace(/\D/g, "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number, text }),
    });

    const ct = res.headers.get("content-type") || "";
    let body: unknown;
    try {
      if (ct.includes("application/json")) {
        body = await res.json();
      } else {
        const t = await res.text();
        body = t || undefined;
      }
    } catch {
      body = undefined;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI",
    };
  }
}
