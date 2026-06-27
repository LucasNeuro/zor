import { uazapiBaseUrlNormalizado, extrairMensagemErroUazapi } from "@/lib/whatsapp/uazapi-http";

export type UazapiSendTextResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

const UAZAPI_FETCH_TIMEOUT_MS = 30_000;
const UAZAPI_FETCH_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUazapiComRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < UAZAPI_FETCH_RETRIES; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(UAZAPI_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = e;
      if (attempt < UAZAPI_FETCH_RETRIES - 1) {
        await sleep(700 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

/** Variantes de `number` para POST /send/text — dígitos primeiro (como IA); JID como fallback. */
export function variantesNumberUazapi(number: string): string[] {
  const n = number.trim();
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };

  push(n);

  const digitsFromJid = n.includes("@") ? n.split("@")[0].replace(/\D/g, "") : "";
  const digits = digitsFromJid || n.replace(/\D/g, "");
  if (digits.length < 10) return out;

  push(digits);
  push(`${digits}@s.whatsapp.net`);

  if (digits.startsWith("5555") && digits.length >= 12) {
    const fixed = `55${digits.slice(4)}`;
    push(fixed);
    push(`${fixed}@s.whatsapp.net`);
  }

  return out;
}

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
      error:
        "UAZAPI_BASE_URL ou token da instância não configurados (instância do agente ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  if (!text.trim()) {
    return { ok: false, error: "Texto da mensagem vazio" };
  }

  const url = `${base}/send/text`;
  const candidates = variantesNumberUazapi(numero.trim());
  let last: { status?: number; body?: unknown; error: string } | null = null;

  for (const number of candidates) {
    try {
      const res = await fetchUazapiComRetry(url, {
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

      if (res.ok) {
        return { ok: true, status: res.status, body };
      }

      const error = extrairMensagemErroUazapi(body, res.status);
      last = { status: res.status, body, error };

      // Só tenta variantes de número em erros de entrega (4xx/5xx), não em 401 auth.
      if (res.status === 401) break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao chamar UAZAPI";
      last = { error: msg.includes("fetch failed") ? `Falha de rede ao contactar UAZAPI (${msg})` : msg };
      // Tenta próxima variante de número; se esgotar, retry já ocorreu em fetchUazapiComRetry.
      continue;
    }
  }

  if (last) {
    return { ok: false, status: last.status, body: last.body, error: last.error };
  }

  return { ok: false, error: "Nenhum destino válido para envio WhatsApp" };
}
