import { uazapiSendText } from "@/lib/whatsapp/uazapi-send";
import {
  uazapiSendMedia,
  type UazapiMediaType,
} from "@/lib/whatsapp/uazapi-send-media";

export type WhatsappSendTextResult =
  | { ok: true; status: number; body?: unknown; provider: "uazapi" }
  | { ok: false; status?: number; body?: unknown; error: string; provider?: "uazapi" };

export function whatsappProvider(): "uazapi" | null {
  if (!process.env.UAZAPI_BASE_URL?.trim()) return null;
  /** Permite só envio por token por linha se BASE_URL existir */
  return "uazapi";
}

/** True se há base URL e token global OU se for enviado token por chamada */
export function whatsappConfigured(opts?: { instanceToken?: string | null }): boolean {
  if (!process.env.UAZAPI_BASE_URL?.trim()) return false;
  if (opts?.instanceToken?.trim()) return true;
  return Boolean(process.env.UAZAPI_INSTANCE_TOKEN?.trim());
}

/** Envia texto via UAZAPI; `numero` pode incluir máscara — normaliza para dígitos. */
export async function whatsappSendText(
  numero: string,
  text: string,
  opts?: { instanceToken?: string | null }
): Promise<WhatsappSendTextResult> {
  const provider = whatsappProvider();
  if (provider === "uazapi") {
    if (!whatsappConfigured(opts)) {
      return {
        ok: false,
        error:
          "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
      };
    }
    const r = await uazapiSendText(numero, text, opts?.instanceToken ?? undefined);
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
  }
  return {
    ok: false,
    error: "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância",
  };
}

export type WhatsappSendMediaOpts = {
  type: UazapiMediaType;
  file: string;
  caption?: string;
  docName?: string;
  mimetype?: string;
  instanceToken?: string | null;
};

/** Envia imagem, documento ou vídeo via UAZAPI /send/media. */
export async function whatsappSendMedia(
  numero: string,
  opts: WhatsappSendMediaOpts
): Promise<WhatsappSendTextResult> {
  const provider = whatsappProvider();
  if (provider === "uazapi") {
    if (!whatsappConfigured({ instanceToken: opts.instanceToken })) {
      return {
        ok: false,
        error:
          "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
      };
    }
    const r = await uazapiSendMedia(
      numero,
      {
        type: opts.type,
        file: opts.file,
        text: opts.caption,
        docName: opts.docName,
        mimetype: opts.mimetype,
      },
      opts.instanceToken ?? undefined
    );
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
  }
  return {
    ok: false,
    error: "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância",
  };
}
