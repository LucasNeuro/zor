import type { NormalizedWhatsappInbound } from "@/lib/whatsapp/webhook-inbound";
import { mistralTranscreverAudioUrl } from "@/lib/whatsapp/mistral-transcribe-audio";
import {
  uazapiObterUrlAudioMensagem,
  uazapiTranscreverAudioMensagem,
} from "@/lib/whatsapp/uazapi-transcribe-audio";

export type MensagemInboundEnriquecida = NormalizedWhatsappInbound & {
  audioTranscrito?: boolean;
  transcricaoFonte?: "webhook" | "uazapi" | "mistral" | "fallback";
};

function extrairTranscricaoDoPayload(body: Record<string, unknown> | undefined): string {
  if (!body) return "";
  const data = body.data ?? body.Data;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return "";

  const d = row as Record<string, unknown>;
  for (const k of ["transcription", "transcricao", "transcript", "speechText"]) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  const content = d.content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const c = content as Record<string, unknown>;
    for (const k of ["transcription", "transcricao", "text"]) {
      const v = c[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  return "";
}

function placeholderMidia(tipo: string): boolean {
  const t = tipo.trim().toLowerCase();
  return t === `[${tipo} recebido]` || t === `[audio recebido]` || t.startsWith("[audio");
}

/**
 * Converte áudio/ptt em texto antes da fila IA.
 * Resposta ao cliente continua em texto; só a entrada é transcrita.
 */
export async function enriquecerMensagemInboundAudio(params: {
  inbound: NormalizedWhatsappInbound;
  instanceToken?: string | null;
  rawBody?: Record<string, unknown>;
}): Promise<MensagemInboundEnriquecida> {
  const { inbound } = params;
  const out: MensagemInboundEnriquecida = { ...inbound };

  if (inbound.tipoMidia !== "audio") return out;

  let texto =
    (inbound.texto?.trim() && !placeholderMidia(inbound.mensagemFinal) ? inbound.texto.trim() : "") ||
    extrairTranscricaoDoPayload(params.rawBody);

  if (texto) {
    out.texto = texto;
    out.mensagemFinal = texto;
    out.audioTranscrito = true;
    out.transcricaoFonte = "webhook";
    return out;
  }

  const messageId = inbound.messageId?.trim();
  const token = params.instanceToken?.trim();
  if (!messageId || !token) {
    out.mensagemFinal =
      "Recebi seu áudio. Não consegui transcrever agora — pode repetir em texto ou enviar outro áudio?";
    out.transcricaoFonte = "fallback";
    return out;
  }

  const uaz = await uazapiTranscreverAudioMensagem(messageId, token);
  if (uaz.ok) {
    texto = uaz.texto;
    out.texto = texto;
    out.mensagemFinal = texto;
    out.audioTranscrito = true;
    out.transcricaoFonte = "uazapi";
    return out;
  }

  const urlRes = await uazapiObterUrlAudioMensagem(messageId, token);
  if (urlRes.ok) {
    const mistral = await mistralTranscreverAudioUrl(urlRes.url);
    if (mistral.ok) {
      texto = mistral.texto;
      out.texto = texto;
      out.mensagemFinal = texto;
      out.audioTranscrito = true;
      out.transcricaoFonte = "mistral";
      return out;
    }
    console.warn("[WA][AUDIO] mistral transcribe:", mistral.erro);
  } else {
    console.warn("[WA][AUDIO] uazapi url:", urlRes.erro);
  }

  console.warn("[WA][AUDIO] uazapi transcribe:", uaz.erro);
  out.mensagemFinal =
    "Recebi seu áudio, mas não consegui transcrever neste momento. Pode resumir em texto o que precisa?";
  out.transcricaoFonte = "fallback";
  return out;
}
