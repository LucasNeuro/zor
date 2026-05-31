import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBOOK_BUCKET } from "./persist";

export const MAX_PLAYBOOK_UPLOAD_BYTES = 1024 * 1024; // 1 MB

const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const TEXT_DECODER_NULL_CHAR = "\u0000";

export type PlaybookUploadValidation =
  | {
      ok: true;
      extension: ".md" | ".txt";
      mimeType: "text/markdown" | "text/plain";
      normalizedName: string;
    }
  | { ok: false; status: number; error: string };

function sanitizeFileName(name: string): string {
  const base = name
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim()
    .replace(/[^\w.\- ]+/g, "_");
  return base && base.length > 0 ? base.slice(0, 120) : "playbook.md";
}

function extractExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".markdown")) return ".markdown";
  if (lower.endsWith(".md")) return ".md";
  if (lower.endsWith(".txt")) return ".txt";
  return "";
}

export function validatePlaybookUploadFile(file: File): PlaybookUploadValidation {
  if (!file.name?.trim()) {
    return { ok: false, status: 400, error: "Arquivo sem nome. Envie um arquivo .md ou .txt." };
  }

  const ext = extractExt(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      status: 415,
      error: "Tipo de arquivo inválido. Envie um playbook em formato .md, .markdown ou .txt.",
    };
  }

  if (file.size <= 0) {
    return { ok: false, status: 422, error: "Arquivo vazio. Envie um conteúdo de playbook válido." };
  }

  if (file.size > MAX_PLAYBOOK_UPLOAD_BYTES) {
    const maxMb = (MAX_PLAYBOOK_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      status: 413,
      error: `Arquivo maior que ${maxMb} MB. Reduza o tamanho e tente novamente.`,
    };
  }

  const normalizedName = sanitizeFileName(file.name);
  if (ext === ".txt") {
    return {
      ok: true,
      extension: ".txt",
      mimeType: "text/plain",
      normalizedName,
    };
  }

  return {
    ok: true,
    extension: ".md",
    mimeType: "text/markdown",
    normalizedName,
  };
}

export function normalizePlaybookText(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function safeSlug(raw: string): string {
  return raw.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
}

export function customPlaybookObjectPath(
  tenantId: string | null | undefined,
  agenteSlug: string,
  ext: ".md" | ".txt"
): string {
  const t = (tenantId && String(tenantId).trim()) || "default";
  return `${t}/${safeSlug(agenteSlug)}-custom${ext}`;
}

async function uploadTextObject(
  supabase: SupabaseClient,
  path: string,
  body: Buffer,
  mimeType: "text/markdown" | "text/plain"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const first = await supabase.storage.from(PLAYBOOK_BUCKET).upload(path, body, {
    contentType: mimeType,
    upsert: true,
  });
  if (!first.error) return { ok: true };

  // Alguns buckets aceitam somente text/markdown.
  if (mimeType === "text/plain") {
    const fallback = await supabase.storage.from(PLAYBOOK_BUCKET).upload(path, body, {
      contentType: "text/markdown",
      upsert: true,
    });
    if (!fallback.error) return { ok: true };
    return { ok: false, error: fallback.error.message };
  }

  return { ok: false, error: first.error.message };
}

export async function uploadCustomPlaybookForAgent(
  supabase: SupabaseClient,
  agenteSlug: string,
  file: File
): Promise<
  | {
      ok: true;
      playbook_object_path: string;
      playbook_public_url: string;
      playbook_generated_at: string;
      playbook_source_hash: string;
      nome_arquivo: string;
      bytes: number;
      tipo: "custom_upload";
    }
  | { ok: false; status: number; error: string }
> {
  const validation = validatePlaybookUploadFile(file);
  if (!validation.ok) return validation;

  const { data: agent, error: agentErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (agentErr) return { ok: false, status: 500, error: agentErr.message };
  if (!agent) return { ok: false, status: 404, error: "Agente não encontrado." };

  const rawText = await file.text();
  if (rawText.includes(TEXT_DECODER_NULL_CHAR)) {
    return {
      ok: false,
      status: 415,
      error: "Arquivo parece binário. Envie um playbook em texto (.md ou .txt).",
    };
  }

  const markdown = normalizePlaybookText(rawText);
  if (!markdown) {
    return { ok: false, status: 422, error: "Playbook vazio após leitura. Revise o arquivo enviado." };
  }

  const sourceHash = createHash("sha256").update(markdown, "utf8").digest("hex");
  const path = customPlaybookObjectPath(agent.tenant_id as string | null | undefined, agenteSlug, validation.extension);
  const bytes = Buffer.from(markdown, "utf8");

  const upload = await uploadTextObject(supabase, path, bytes, validation.mimeType);
  if (!upload.ok) return { ok: false, status: 500, error: upload.error };

  const { data: pub } = supabase.storage.from(PLAYBOOK_BUCKET).getPublicUrl(path);
  const generatedAt = new Date().toISOString();

  const { error: dbErr } = await supabase
    .from("hub_agente_identidade")
    .update({
      playbook_object_path: path,
      playbook_public_url: pub.publicUrl,
      playbook_generated_at: generatedAt,
      playbook_source_hash: sourceHash,
    })
    .eq("agente_slug", agenteSlug);

  if (dbErr) return { ok: false, status: 500, error: dbErr.message };

  return {
    ok: true,
    playbook_object_path: path,
    playbook_public_url: pub.publicUrl,
    playbook_generated_at: generatedAt,
    playbook_source_hash: sourceHash,
    nome_arquivo: validation.normalizedName,
    bytes: bytes.byteLength,
    tipo: "custom_upload",
  };
}

export async function savePlaybookMarkdownForAgent(
  supabase: SupabaseClient,
  agenteSlug: string,
  markdownRaw: string
): Promise<
  | {
      ok: true;
      playbook_object_path: string;
      playbook_public_url: string;
      playbook_generated_at: string;
      playbook_source_hash: string;
      bytes: number;
      tipo: "editor_save";
    }
  | { ok: false; status: number; error: string }
> {
  const markdown = normalizePlaybookText(markdownRaw);
  if (!markdown) {
    return { ok: false, status: 422, error: "Playbook vazio. Escreva ou carregue conteúdo antes de publicar." };
  }

  const bytes = Buffer.from(markdown, "utf8");
  if (bytes.byteLength > MAX_PLAYBOOK_UPLOAD_BYTES) {
    const maxMb = (MAX_PLAYBOOK_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      status: 413,
      error: `Playbook maior que ${maxMb} MB. Reduza o tamanho e tente novamente.`,
    };
  }

  const { data: agent, error: agentErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id, playbook_object_path")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (agentErr) return { ok: false, status: 500, error: agentErr.message };
  if (!agent) return { ok: false, status: 404, error: "Agente não encontrado." };

  const existingPath = String(agent.playbook_object_path ?? "").trim();
  const ext: ".md" | ".txt" = existingPath.toLowerCase().endsWith(".txt") ? ".txt" : ".md";
  const mimeType: "text/markdown" | "text/plain" = ext === ".txt" ? "text/plain" : "text/markdown";
  const path =
    existingPath ||
    customPlaybookObjectPath(agent.tenant_id as string | null | undefined, agenteSlug, ext);
  const sourceHash = createHash("sha256").update(markdown, "utf8").digest("hex");

  const upload = await uploadTextObject(supabase, path, bytes, mimeType);
  if (!upload.ok) return { ok: false, status: 500, error: upload.error };

  const { data: pub } = supabase.storage.from(PLAYBOOK_BUCKET).getPublicUrl(path);
  const generatedAt = new Date().toISOString();

  const { error: dbErr } = await supabase
    .from("hub_agente_identidade")
    .update({
      playbook_object_path: path,
      playbook_public_url: pub.publicUrl,
      playbook_generated_at: generatedAt,
      playbook_source_hash: sourceHash,
    })
    .eq("agente_slug", agenteSlug);

  if (dbErr) return { ok: false, status: 500, error: dbErr.message };

  return {
    ok: true,
    playbook_object_path: path,
    playbook_public_url: pub.publicUrl,
    playbook_generated_at: generatedAt,
    playbook_source_hash: sourceHash,
    bytes: bytes.byteLength,
    tipo: "editor_save",
  };
}

export async function loadCurrentPlaybookMarkdown(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<
  | {
      ok: true;
      markdown: string;
      origem: "object_path" | "public_url";
      playbook_object_path: string | null;
      playbook_public_url: string | null;
    }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("playbook_object_path, playbook_public_url")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: "Agente não encontrado." };

  const objectPath = String(data.playbook_object_path || "").trim();
  const publicUrl = String(data.playbook_public_url || "").trim();
  if (!objectPath && !publicUrl) {
    return {
      ok: false,
      status: 409,
      error: "Agente sem playbook publicado. Gere ou envie um playbook antes de analisar.",
    };
  }

  if (objectPath) {
    const { data: blob, error: dlErr } = await supabase.storage.from(PLAYBOOK_BUCKET).download(objectPath);
    if (dlErr || !blob) return { ok: false, status: 502, error: dlErr?.message || "Falha ao baixar playbook." };
    const markdown = normalizePlaybookText(await blob.text());
    if (!markdown) return { ok: false, status: 422, error: "Playbook publicado está vazio." };
    return {
      ok: true,
      markdown,
      origem: "object_path",
      playbook_object_path: objectPath,
      playbook_public_url: publicUrl || null,
    };
  }

  const res = await fetch(publicUrl, { method: "GET" });
  if (!res.ok) return { ok: false, status: 502, error: `HTTP ${res.status} ao ler playbook_public_url.` };
  const markdown = normalizePlaybookText(await res.text());
  if (!markdown) return { ok: false, status: 422, error: "Playbook publicado está vazio." };
  return {
    ok: true,
    markdown,
    origem: "public_url",
    playbook_object_path: null,
    playbook_public_url: publicUrl,
  };
}
