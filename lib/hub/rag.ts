import type { SupabaseClient } from "@supabase/supabase-js";
import { inflateRawSync, inflateSync } from "zlib";
import { extensaoArquivo } from "@/lib/hub/rag-formatos";
import {
  extrairTextoDocx,
  extrairTextoOdt,
  extrairTextoPptx,
  extrairTextoXlsx,
} from "@/lib/hub/rag-zip";

export { RAG_ACCEPT_ATTR, RAG_EXEMPLO_MD_URL, RAG_EXTENSOES_ACEITAS, RAG_FORMATOS_RESUMO } from "@/lib/hub/rag-formatos";
export { ragErroPdfSemTexto, ragExtensaoAceita } from "@/lib/hub/rag-formatos";

export const RAG_BUCKET = "hub-agent-rag-docs";
export const RAG_EMBEDDING_DIMENSIONS = 1024;

const MISTRAL_EMBEDDINGS_URL = "https://api.mistral.ai/v1/embeddings";
const CHUNK_MAX_CHARS = 1_800;
const CHUNK_OVERLAP_CHARS = 220;
const MAX_CHUNKS_PER_DOCUMENT = 80;
const EMBEDDING_BATCH_SIZE = 16;

export type RagDocumento = {
  id: string;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number;
  status: "indexando" | "pronto" | "erro";
  chunks_count: number;
  erro: string | null;
  criado_em: string;
  indexado_em: string | null;
};

export type RagTrecho = {
  nomeArquivo: string;
  conteudo: string;
  similarity: number;
};

function safeSegment(s: string, fallback: string): string {
  const cleaned = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return cleaned || fallback;
}

export function ragObjectPath(tenantId: string | null | undefined, agenteSlug: string, fileName: string): string {
  const tenant = safeSegment(String(tenantId || "default"), "default");
  const slug = safeSegment(agenteSlug, "agente");
  const name = safeSegment(fileName, "documento.txt");
  return `${tenant}/${slug}/${Date.now()}-${name}`;
}

function normalizarTexto(s: string): string {
  return s
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizarChunksParaEmbedding(chunks: string[]): string[] {
  return chunks
    .map((c) => normalizarTexto(c))
    .filter((c) => c.length >= 20 && /[a-zA-Z0-9\u00C0-\u024F]{4,}/.test(c));
}

function decodePdfHexString(hexRaw: string): string {
  const hex = hexRaw.replace(/\s/g, "");
  if (!hex || hex.length < 2 || hex.length % 2 !== 0) return "";
  let buf: Buffer;
  try {
    buf = Buffer.from(hex, "hex");
  } catch {
    return "";
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < buf.length; i += 2) {
      out += String.fromCharCode(buf.readUInt16BE(i));
    }
    return out;
  }
  return buf.toString("latin1");
}

function decodePdfLiteralString(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = s[i + 1];
    if (!next) break;
    if (next === "n") {
      out += "\n";
      i++;
      continue;
    }
    if (next === "r") {
      out += "\r";
      i++;
      continue;
    }
    if (next === "t") {
      out += "\t";
      i++;
      continue;
    }
    if (next === "b") {
      out += "\b";
      i++;
      continue;
    }
    if (next === "f") {
      out += "\f";
      i++;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      out += next;
      i++;
      continue;
    }
    if (/[0-7]/.test(next)) {
      const oct = s.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0];
      if (oct) {
        out += String.fromCharCode(parseInt(oct, 8));
        i += oct.length;
        continue;
      }
    }
    out += next;
    i++;
  }
  return out;
}

function extractPdfTextBasic(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streams: Buffer[] = [];
  let seek = 0;
  while (seek < raw.length) {
    const streamIdx = raw.indexOf("stream", seek);
    if (streamIdx < 0) break;
    const eolMatch = raw.slice(streamIdx, streamIdx + 12).match(/^stream\r?\n/);
    if (!eolMatch) {
      seek = streamIdx + 6;
      continue;
    }
    const start = streamIdx + eolMatch[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const chunk = buffer.subarray(start, end);
    streams.push(chunk);
    seek = end + 9;
  }

  const textParts: string[] = [];
  const pushFromContent = (content: string) => {
    const tj = content.match(/\((?:\\.|[^\\)])*\)\s*Tj/gm) ?? [];
    for (const hit of tj) {
      const literal = hit.match(/\(([\s\S]*)\)\s*Tj$/m)?.[1];
      if (!literal) continue;
      textParts.push(decodePdfLiteralString(literal));
    }

    const hexTj = content.match(/<([0-9A-Fa-f\s]+)>\s*Tj/g) ?? [];
    for (const hit of hexTj) {
      const hex = hit.match(/<([0-9A-Fa-f\s]+)>\s*Tj/)?.[1];
      if (hex) textParts.push(decodePdfHexString(hex));
    }

    const tjs = content.match(/\[(?:[\s\S]*?)\]\s*TJ/gm) ?? [];
    for (const hit of tjs) {
      const literals = hit.match(/\((?:\\.|[^\\)])*\)/gm) ?? [];
      for (const lit of literals) {
        textParts.push(decodePdfLiteralString(lit.slice(1, -1)));
      }
      const hexLiterals = hit.match(/<([0-9A-Fa-f\s]+)>/g) ?? [];
      for (const lit of hexLiterals) {
        textParts.push(decodePdfHexString(lit.slice(1, -1)));
      }
      textParts.push("\n");
    }
  };

  for (const stream of streams) {
    let decoded: Buffer | null = null;
    try {
      decoded = inflateSync(stream);
    } catch {
      try {
        decoded = inflateRawSync(stream);
      } catch {
        decoded = stream;
      }
    }
    pushFromContent(decoded.toString("latin1"));
  }

  if (textParts.length === 0) {
    const rawLiterals = raw.match(/\((?:\\.|[^\\)]){8,}\)/gm) ?? [];
    for (const lit of rawLiterals.slice(0, 1500)) {
      textParts.push(decodePdfLiteralString(lit.slice(1, -1)));
    }
  }

  return normalizarTexto(textParts.join(" "));
}

const RAG_MIN_TEXTO = 40;

function extrairHtmlTexto(buffer: Buffer): string {
  const raw = buffer.toString("utf8");
  return normalizarTexto(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function extrairRtfTexto(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const semBlocos = raw.replace(/\{\\\*?\\[^{}]+|[{}]/g, " ");
  return normalizarTexto(semBlocos.replace(/\\'[0-9a-f]{2}/gi, " "));
}

function bufferComoTextoUtf8(buffer: Buffer): string | null {
  const s = buffer.toString("utf8");
  if (s.includes("\uFFFD")) return null;
  const len = Math.max(1, s.length);
  let ok = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 0xfffe)) ok += 1;
  }
  if (ok / len < 0.82) return null;
  return normalizarTexto(s);
}

function validarTextoExtraido(texto: string, contexto: string): { ok: true; texto: string } | { ok: false; error: string } {
  if (texto.length >= RAG_MIN_TEXTO) return { ok: true, texto };
  const prefix = contexto.trim() ? `${contexto.trim()} ` : "";
  return {
    ok: false,
    error: `${prefix}Documento sem texto suficiente para indexar (mínimo ~${RAG_MIN_TEXTO} caracteres).`.trim(),
  };
}

export function extrairTextoDocumentoRag(
  fileName: string,
  mimeType: string | null | undefined,
  buffer: Buffer
): { ok: true; texto: string } | { ok: false; error: string } {
  const mime = (mimeType || "").toLowerCase();
  const ext = extensaoArquivo(fileName);

  const isTextoPlano =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "text/xml" ||
    [".md", ".markdown", ".txt", ".csv", ".json", ".xml"].includes(ext);

  if (mime === "application/pdf" || ext === ".pdf") {
    const textoPdf = extractPdfTextBasic(buffer);
    if (textoPdf.length < RAG_MIN_TEXTO) {
      return {
        ok: false,
        error:
          "PDF enviado para o Storage, mas não foi possível extrair texto suficiente. Se for digitalizado (imagem), exporte como .docx ou use o ficheiro .md de exemplo. PDFs «Imprimir para PDF» do browser costumam falhar.",
      };
    }
    return { ok: true, texto: textoPdf };
  }

  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return validarTextoExtraido(extrairTextoDocx(buffer), "DOCX:");
  }

  if (ext === ".odt" || mime === "application/vnd.oasis.opendocument.text") {
    return validarTextoExtraido(extrairTextoOdt(buffer), "ODT:");
  }

  if (
    ext === ".xlsx" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return validarTextoExtraido(extrairTextoXlsx(buffer), "XLSX:");
  }

  if (
    ext === ".pptx" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return validarTextoExtraido(extrairTextoPptx(buffer), "PPTX:");
  }

  if (ext === ".rtf" || mime === "application/rtf" || mime === "text/rtf") {
    return validarTextoExtraido(extrairRtfTexto(buffer), "RTF:");
  }

  if (ext === ".html" || ext === ".htm" || mime === "text/html") {
    return validarTextoExtraido(extrairHtmlTexto(buffer), "HTML:");
  }

  if (isTextoPlano) {
    const texto = normalizarTexto(buffer.toString("utf8"));
    return validarTextoExtraido(texto, "");
  }

  const fallback = bufferComoTextoUtf8(buffer);
  if (fallback) {
    return validarTextoExtraido(fallback, "");
  }

  return {
    ok: false,
    error: `Formato não suportado (${ext || mime || "desconhecido"}). Use: .txt, .md, .csv, .json, .xml, .pdf, .docx, .odt, .rtf, .html, .xlsx, .pptx.`,
  };
}

export function chunkTextRag(texto: string): string[] {
  const clean = normalizarTexto(texto);
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const hardEnd = Math.min(start + CHUNK_MAX_CHARS, clean.length);
    let end = hardEnd;

    if (hardEnd < clean.length) {
      const paragraphBreak = clean.lastIndexOf("\n\n", hardEnd);
      const sentenceBreak = clean.lastIndexOf(". ", hardEnd);
      const candidate = Math.max(paragraphBreak, sentenceBreak);
      if (candidate > start + 700) end = candidate + (candidate === sentenceBreak ? 1 : 0);
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 40) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }

  return chunks;
}

async function mistralEmbedTexts(inputs: string[]): Promise<{ ok: true; embeddings: number[][] } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada para gerar embeddings." };

  const model = process.env.MISTRAL_EMBED_MODEL?.trim() || "mistral-embed";
  const embeddings: number[][] = [];
  const limpos = sanitizarChunksParaEmbedding(inputs);
  if (limpos.length === 0) {
    return {
      ok: false,
      error:
        "Nenhum trecho com texto legível para embedding. Use .md ou .docx em vez de PDF digitalizado.",
    };
  }

  for (let i = 0; i < limpos.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = limpos.slice(i, i + EMBEDDING_BATCH_SIZE);
    const res = await fetch(MISTRAL_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      // API REST Mistral: campo `input` (string ou array), não `inputs`.
      body: JSON.stringify({ model, input: batch.length === 1 ? batch[0] : batch }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      return { ok: false, error: `Mistral embeddings: ${msg || `HTTP ${res.status}`}`.slice(0, 360) };
    }

    const data = (await res.json()) as {
      data?: Array<{ embedding?: unknown; index?: number }>;
    };
    const ordered = [...(data.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const item of ordered) {
      if (!Array.isArray(item.embedding)) {
        return { ok: false, error: "Mistral devolveu embedding inválido." };
      }
      const vector = item.embedding.map((n) => Number(n));
      if (vector.length !== RAG_EMBEDDING_DIMENSIONS) {
        return {
          ok: false,
          error: `Dimensão do embedding (${vector.length}) difere da tabela (${RAG_EMBEDDING_DIMENSIONS}).`,
        };
      }
      embeddings.push(vector);
    }
  }

  if (embeddings.length !== limpos.length) {
    return { ok: false, error: "Mistral devolveu quantidade de embeddings diferente dos chunks." };
  }

  return { ok: true, embeddings };
}

async function marcarDocumentoErro(supabase: SupabaseClient, documentoId: string, erro: string) {
  await supabase
    .from("hub_agente_rag_documentos")
    .update({ status: "erro", erro: erro.slice(0, 500), indexado_em: new Date().toISOString() })
    .eq("id", documentoId);
}

export async function reindexarDocumentoRagFromStorage(params: {
  supabase: SupabaseClient;
  documento: {
    id: string;
    agente_slug: string;
    tenant_id?: string | null;
    bucket_id: string;
    object_path: string;
    nome_arquivo: string;
    mime_type?: string | null;
  };
}): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const bucket = params.documento.bucket_id || RAG_BUCKET;
  const { data: blob, error: dlErr } = await params.supabase.storage
    .from(bucket)
    .download(params.documento.object_path);

  if (dlErr || !blob) {
    const error = dlErr?.message || "Não foi possível ler o ficheiro no Storage.";
    await marcarDocumentoErro(params.supabase, params.documento.id, error);
    return { ok: false, error };
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const texto = extrairTextoDocumentoRag(
    params.documento.nome_arquivo,
    params.documento.mime_type,
    bytes
  );

  if (!texto.ok) {
    await marcarDocumentoErro(params.supabase, params.documento.id, texto.error);
    return { ok: false, error: texto.error };
  }

  await params.supabase
    .from("hub_agente_rag_documentos")
    .update({ status: "indexando", erro: null, chunks_count: 0 })
    .eq("id", params.documento.id);

  return indexarDocumentoRag({
    supabase: params.supabase,
    documentoId: params.documento.id,
    agenteSlug: params.documento.agente_slug,
    tenantId: params.documento.tenant_id,
    texto: texto.texto,
  });
}

export async function indexarDocumentoRag(params: {
  supabase: SupabaseClient;
  documentoId: string;
  agenteSlug: string;
  tenantId?: string | null;
  texto: string;
}): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const chunksBrutos = chunkTextRag(params.texto);
  const chunks = sanitizarChunksParaEmbedding(chunksBrutos);
  if (chunks.length === 0) {
    const error = "Documento sem chunks úteis para indexar.";
    await marcarDocumentoErro(params.supabase, params.documentoId, error);
    return { ok: false, error };
  }

  const embed = await mistralEmbedTexts(chunks);
  if (!embed.ok) {
    await marcarDocumentoErro(params.supabase, params.documentoId, embed.error);
    return embed;
  }

  await params.supabase.from("hub_agente_rag_chunks").delete().eq("document_id", params.documentoId);

  const rows = chunks.map((conteudo, i) => ({
    document_id: params.documentoId,
    tenant_id: params.tenantId || null,
    agente_slug: params.agenteSlug,
    chunk_index: i,
    conteudo,
    embedding: embed.embeddings[i],
    metadata: { source: "wizard_upload" },
  }));

  const { error: insertErr } = await params.supabase.from("hub_agente_rag_chunks").insert(rows);
  if (insertErr) {
    await marcarDocumentoErro(params.supabase, params.documentoId, insertErr.message);
    return { ok: false, error: insertErr.message };
  }

  const { error: docErr } = await params.supabase
    .from("hub_agente_rag_documentos")
    .update({
      status: "pronto",
      chunks_count: chunks.length,
      erro: null,
      indexado_em: new Date().toISOString(),
    })
    .eq("id", params.documentoId);

  if (docErr) return { ok: false, error: docErr.message };
  return { ok: true, chunks: chunks.length };
}

export async function buscarTrechosRag(
  supabase: SupabaseClient,
  agenteSlug: string,
  pergunta: string,
  opts?: { limit?: number; threshold?: number }
): Promise<RagTrecho[]> {
  const texto = pergunta.trim();
  if (texto.length < 3) return [];

  const embed = await mistralEmbedTexts([texto]);
  if (!embed.ok) {
    console.warn("[rag] embedding pergunta falhou:", embed.error);
    return [];
  }

  const vectorLiteral = `[${embed.embeddings[0].join(",")}]`;
  const { data, error } = await supabase.rpc("match_hub_agente_rag_chunks", {
    p_agente_slug: agenteSlug,
    p_query_embedding: vectorLiteral,
    p_match_count: opts?.limit ?? 5,
    p_similarity_threshold: opts?.threshold ?? 0.68,
  });

  if (error) {
    console.warn("[rag] match falhou:", error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    nomeArquivo: String(row.nome_arquivo ?? "documento"),
    conteudo: String(row.conteudo ?? ""),
    similarity: Number(row.similarity ?? 0),
  }));
}
