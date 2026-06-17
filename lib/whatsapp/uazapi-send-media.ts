import { uazapiBaseUrlNormalizado } from "@/lib/whatsapp/uazapi-http";

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
        "UAZAPI_BASE_URL ou token da instância não configurados (instância do agente ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const raw = numero.trim();
  const number =
    raw.includes("@g.us") ||
    raw.includes("@s.whatsapp.net") ||
    raw.includes("@lid") ||
    raw.includes("@newsletter")
      ? raw
      : raw.replace(/\D/g, "");

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

    if (!res.ok) {
      return { ok: false, status: res.status, body: resBody, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, body: resBody };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI /send/media",
    };
  }
}
