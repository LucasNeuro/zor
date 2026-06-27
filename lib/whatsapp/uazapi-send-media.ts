import { extrairMensagemErroUazapi, uazapiBaseUrlNormalizado } from "@/lib/whatsapp/uazapi-http";
import { variantesNumberUazapi } from "@/lib/whatsapp/uazapi-send";

export type UazapiMediaType = "image" | "document" | "video" | "audio" | "ptt";

export type UazapiSendMediaResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

export async function uazapiSendMedia(
  numero: string,
  opts: {
    type: UazapiMediaType;
    file: string;
    text?: string;
    docName?: string;
    mimetype?: string;
  },
  instanceToken?: string | null
): Promise<UazapiSendMediaResult> {
  const base = uazapiBaseUrlNormalizado();
  const token = (instanceToken?.trim() || process.env.UAZAPI_INSTANCE_TOKEN?.trim()) ?? "";

  if (!base || !token) {
    return {
      ok: false,
      error:
        "WhatsApp não configurado. Reconecte o canal do agente em Canais.",
    };
  }

  const candidates = variantesNumberUazapi(numero.trim());
  let last: { status?: number; body?: unknown; error: string } | null = null;

  for (const number of candidates) {
    const body: Record<string, unknown> = {
      number,
      type: opts.type,
      file: opts.file,
    };
    if (opts.text?.trim()) body.text = opts.text.trim();
    if (opts.docName?.trim()) body.docName = opts.docName.trim();
    if (opts.mimetype?.trim()) body.mimetype = opts.mimetype.trim();

    try {
      const res = await fetch(`${base}/send/media`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token,
        },
        body: JSON.stringify(body),
      });

      const ct = res.headers.get("content-type") || "";
      let resBody: unknown;
      try {
        if (ct.includes("application/json")) {
          resBody = await res.json();
        } else {
          const t = await res.text();
          resBody = t || undefined;
        }
      } catch {
        resBody = undefined;
      }

      if (res.ok) {
        return { ok: true, status: res.status, body: resBody };
      }

      last = {
        status: res.status,
        body: resBody,
        error: extrairMensagemErroUazapi(resBody, res.status),
      };
      if (res.status === 401) break;
    } catch (e) {
      last = {
        error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI /send/media",
      };
      break;
    }
  }

  if (last) {
    return { ok: false, status: last.status, body: last.body, error: last.error };
  }

  return { ok: false, error: "Nenhum destino válido para envio de mídia WhatsApp" };
}
