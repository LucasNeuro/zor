import { evolutionSendText } from "@/lib/whatsapp/evolution-send";
import { uazapiSendText } from "@/lib/whatsapp/uazapi-send";

export type WhatsappSendTextResult =
  | { ok: true; status: number; body?: unknown; provider: "uazapi" | "evolution" }
  | { ok: false; status?: number; body?: unknown; error: string; provider?: "uazapi" | "evolution" };

/** UAZAPI tem prioridade se URL + token da instância estiverem definidos. */
export function whatsappProvider(): "uazapi" | "evolution" | null {
  if (process.env.UAZAPI_BASE_URL?.trim() && process.env.UAZAPI_INSTANCE_TOKEN?.trim()) {
    return "uazapi";
  }
  if (process.env.EVOLUTION_API_URL?.trim() && process.env.EVOLUTION_API_KEY?.trim()) {
    return "evolution";
  }
  return null;
}

export function whatsappConfigured(): boolean {
  return whatsappProvider() !== null;
}

/** Envia texto; `numero` pode incluir máscara — normaliza para dígitos na UAZAPI. */
export async function whatsappSendText(numero: string, text: string): Promise<WhatsappSendTextResult> {
  const provider = whatsappProvider();
  if (provider === "uazapi") {
    const r = await uazapiSendText(numero, text);
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
  }
  if (provider === "evolution") {
    const digits = numero.replace(/\D/g, "");
    const r = await evolutionSendText(digits, text);
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "evolution" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "evolution" };
  }
  return { ok: false, error: "Nenhum provedor WhatsApp configurado (UAZAPI ou Evolution)" };
}
