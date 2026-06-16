export type TipoMidiaChat = "texto" | "audio" | "imagem" | "documento" | "video";

export type MidiaMensagemChat = {
  tipo: TipoMidiaChat;
  urlMidia: string | null;
  nomeArquivo: string | null;
  whatsappMessageId: string | null;
};

const TIPOS_MIDIA = new Set<TipoMidiaChat>(["audio", "imagem", "documento", "video"]);

export function metaRecordMidia(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.metadados ?? row.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export function conteudoEhPlaceholderMidia(conteudo: string, tipo: TipoMidiaChat): boolean {
  const t = conteudo.trim().toLowerCase();
  if (!t) return tipo !== "texto";
  if (t === `[${tipo} recebido]` || t === `[${tipo} enviado pelo celular]`) return true;
  if (tipo === "audio" && (t === "[audio recebido]" || t.startsWith("[audio"))) return true;
  return /^\[(audio|imagem|documento|video|ptt)(\s|])/.test(t);
}

export function parseMidiaFromRow(row: Record<string, unknown>): MidiaMensagemChat {
  const meta = metaRecordMidia(row);
  const tipoRaw = String(
    row.tipo_conteudo ?? row.tipo_midia ?? meta.tipo_midia ?? "texto"
  )
    .trim()
    .toLowerCase();

  let tipo: TipoMidiaChat = "texto";
  if (tipoRaw.includes("audio") || tipoRaw === "ptt") tipo = "audio";
  else if (tipoRaw.includes("image") || tipoRaw === "imagem") tipo = "imagem";
  else if (tipoRaw.includes("document")) tipo = "documento";
  else if (tipoRaw.includes("video")) tipo = "video";
  else if (TIPOS_MIDIA.has(tipoRaw as TipoMidiaChat)) tipo = tipoRaw as TipoMidiaChat;

  const conteudo = String(row.conteudo ?? "").trim().toLowerCase();
  if (tipo === "texto" && (conteudo.includes("[audio") || conteudo === "[audio recebido]")) {
    tipo = "audio";
  }

  const urlMidia =
    String(row.url_midia ?? meta.url_midia ?? meta.file_url ?? "").trim() || null;
  const nomeArquivo =
    String(row.nome_arquivo ?? meta.nome_arquivo ?? meta.file_name ?? "").trim() || null;
  const whatsappMessageId =
    String(row.whatsapp_message_id ?? meta.message_id ?? "").trim() || null;

  return { tipo, urlMidia, nomeArquivo, whatsappMessageId };
}

export function mensagemTemCorpo(row: Record<string, unknown>): boolean {
  const conteudo = String(row.conteudo ?? "").trim();
  const midia = parseMidiaFromRow(row);
  if (midia.tipo !== "texto") return true;
  return conteudo.length > 0;
}
