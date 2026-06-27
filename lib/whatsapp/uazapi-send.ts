import { uazapiBaseUrlNormalizado, extrairMensagemErroUazapi } from "@/lib/whatsapp/uazapi-http";

export type UazapiSendTextResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

function normalizarNumberUazapi(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.includes("@g.us") ||
    trimmed.includes("@s.whatsapp.net") ||
    trimmed.includes("@lid") ||
    trimmed.includes("@newsletter")
  ) {
    return trimmed;
  }
  return trimmed.replace(/\D/g, "");
}

function variantesNumberUazapi(number: string): string[] {
  const n = number.trim();
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };

  push(n);
  if (n.includes("@")) return out;

  const digits = n.replace(/\D/g, "");
  if (!digits) return out;

  push(digits);
  if (!digits.includes("@")) {
    push(`${digits}@s.whatsapp.net`);
  }

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

  const url = `${base}/send/text`;
  const candidates = variantesNumberUazapi(normalizarNumberUazapi(numero));
  let last: { status?: number; body?: unknown; error: string } | null = null;

  for (const number of candidates) {
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

      if (res.ok) {
        return { ok: true, status: res.status, body };
      }

      const error = extrairMensagemErroUazapi(body, res.status);
      last = { status: res.status, body, error };

      // Só tenta variantes de número em erros de entrega (4xx/5xx), não em 401 auth.
      if (res.status === 401) break;
    } catch (e) {
      last = {
        error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI",
      };
      break;
    }
  }

  if (last) {
    return { ok: false, status: last.status, body: last.body, error: last.error };
  }

  return { ok: false, error: "Nenhum destino válido para envio WhatsApp" };
}
