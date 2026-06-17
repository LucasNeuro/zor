import type { TipoMidiaChat } from "@/lib/crm/chat-mensagem-midia";

export const MAX_ANEXO_CHAT_BYTES = 12 * 1024 * 1024;

export type MidiaAnexoEnviar = {
  base64: string;
  mimeType: string;
  nomeArquivo: string;
  legenda?: string;
};

export function uazapiTipoDeMime(mime: string): "image" | "document" | "video" | null {
  const m = mime.trim().toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (
    m.startsWith("application/") ||
    m.startsWith("text/") ||
    m === "application/pdf" ||
    m.includes("document") ||
    m.includes("sheet") ||
    m.includes("word")
  ) {
    return "document";
  }
  return "document";
}

export function tipoMidiaChatDeMime(mime: string): TipoMidiaChat {
  const u = uazapiTipoDeMime(mime);
  if (u === "image") return "imagem";
  if (u === "video") return "video";
  return "documento";
}

export function placeholderMidiaEnviada(tipo: TipoMidiaChat): string {
  if (tipo === "imagem") return "[imagem enviada]";
  if (tipo === "video") return "[vídeo enviado]";
  if (tipo === "documento") return "[documento enviado]";
  return "[arquivo enviado]";
}

export function base64ParaUazapiFile(base64: string, mimeType: string): string {
  const raw = base64.trim();
  if (raw.startsWith("data:")) return raw;
  const mime = mimeType.trim() || "application/octet-stream";
  return `data:${mime};base64,${raw}`;
}
