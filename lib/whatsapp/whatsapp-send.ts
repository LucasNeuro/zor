import { uazapiSendText } from "@/lib/whatsapp/uazapi-send";

export type WhatsappSendTextResult =
  | { ok: true; status: number; body?: unknown; provider: "uazapi" }
  | { ok: false; status?: number; body?: unknown; error: string; provider?: "uazapi" };

export function whatsappProvider(): "uazapi" | null {
  if (process.env.UAZAPI_BASE_URL?.trim() && process.env.UAZAPI_INSTANCE_TOKEN?.trim()) {
    return "uazapi";
  }
  return null;
}

export function whatsappConfigured(): boolean {
  return whatsappProvider() !== null;
}

/** Envia texto via UAZAPI; `numero` pode incluir máscara — normaliza para dígitos. */
export async function whatsappSendText(numero: string, text: string): Promise<WhatsappSendTextResult> {
  const provider = whatsappProvider();
  if (provider === "uazapi") {
    const r = await uazapiSendText(numero, text);
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
  }
  return { ok: false, error: "WhatsApp não configurado: defina UAZAPI_BASE_URL + UAZAPI_INSTANCE_TOKEN" };
}
