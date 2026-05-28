import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAYBOOK_BUCKET } from "./persist";

type PlaybookMeta = {
  playbook_generated_at?: string | null;
  playbook_object_path?: string | null;
  playbook_public_url?: string | null;
  playbook_source_hash?: string | null;
};

type PublishedPlaybookMode = "prompt_unificado" | "runtime_core" | "full_markdown";

export type PublishedPlaybookLoadResult =
  | {
      ok: true;
      prompt: string;
      rawMarkdown: string;
      path: string;
      hash: string | null;
      mode: PublishedPlaybookMode;
      /** Recorte leve de secções 2–5 e 9 do markdown (útil em full_markdown). */
      flowHints: string | null;
    }
  | {
      ok: false;
      reason: "missing_meta" | "download_error" | "empty_file";
      detail?: string;
    };

const CACHE_TTL_MS = 5 * 60 * 1000;

const publishedPlaybookCache = new Map<
  string,
  {
    expireAt: number;
    result: Extract<PublishedPlaybookLoadResult, { ok: true }>;
  }
>();

function cacheKey(meta: PlaybookMeta, agenteSlug: string): string {
  const path = String(meta.playbook_object_path || meta.playbook_public_url || "").trim();
  const hash = String(meta.playbook_source_hash || meta.playbook_generated_at || "").trim();
  return `${agenteSlug}::${path}::${hash}`;
}

function stripFrontmatter(md: string): string {
  const normalized = md.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return normalized;
  return normalized.slice(end + 5);
}

function trimMarkdownBody(md: string): string {
  return stripFrontmatter(md).replace(/^\s+|\s+$/g, "");
}

/**
 * Remove rodapé administrativo e neutraliza placeholders de exemplo
 * para o modelo não confundir autor/responsável com o nome do cliente.
 */
export function sanitizePlaybookForRuntime(text: string): string {
  let body = text.replace(/\r\n/g, "\n");

  const metaStart = body.search(
    /\n---\s*\n\s*(?:Vers[aã]o|Version|Data:|Organiza[cç][aã]o|Respons[aá]vel:)/i
  );
  if (metaStart >= 0) {
    body = body.slice(0, metaStart).trim();
  } else {
    const respIdx = body.search(/\nRespons[aá]vel:\s*.+/i);
    if (respIdx >= 0 && respIdx > body.length * 0.55) {
      body = body.slice(0, respIdx).trim();
    }
  }

  body = body.replace(
    /\[Nome\]/gi,
    "(nome do cliente — só use após o cliente informar ou confirmar no canal)"
  );

  body = body
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^Respons[aá]vel:\s*.+/i.test(t)) return false;
      if (/^Vers[aã]o:\s*.+/i.test(t)) return false;
      if (/^Organiza[cç][aã]o:\s*.+/i.test(t)) return false;
      if (/^Data:\s*\d/i.test(t)) return false;
      return true;
    })
    .join("\n");

  return body.trim();
}

function extractPromptUnificado(md: string): string | null {
  const body = trimMarkdownBody(md);
  const headingRe =
    /##\s+Prompt unificado \(produção[^\n]*\)[\s\S]*?```text\s*([\s\S]*?)\s*```/i;
  const match = body.match(headingRe);
  if (!match?.[1]) return null;
  const text = match[1].trim();
  return text || null;
}

function extractRuntimeCore(md: string): string | null {
  const body = trimMarkdownBody(md);
  const markers = [
    "## Runtime Core",
    "## Runtime core",
    "## Instruções canónicas (Agno / operação)",
    "## Instrucoes canonicas (Agno / operacao)",
  ];
  for (const marker of markers) {
    const idx = body.indexOf(marker);
    if (idx < 0) continue;
    const tail = body.slice(idx);
    const nextHeading = tail.slice(marker.length).search(/\n##\s+/);
    const section = nextHeading >= 0 ? tail.slice(0, marker.length + nextHeading) : tail;
    const cleaned = section.trim();
    if (cleaned) return cleaned;
  }
  return null;
}

const FLOW_HINT_SECTION_RE =
  /^##\s+(?:([2-5]|9)[\.\)\s]|.*\b(comum|triagem|arquitetura|imobili[aá]rio|regras?\s*(gerais|operacionais|whatsapp)|cards?\s*e\s*crm|encerramento)\b)/i;

const FLOW_HINTS_MAX_CHARS = 4_500;

/**
 * Extrai cabeçalhos e corpo inicial das secções operacionais do playbook unificado.
 * Não altera o modo full_markdown — só fornece índice para o prompt-builder.
 */
export function extractRuntimeFlowHints(md: string): string | null {
  const lines = trimMarkdownBody(md).split("\n");
  const chunks: string[] = [];
  let buf: string[] = [];
  let capturing = false;

  const flush = () => {
    if (!capturing || buf.length === 0) return;
    const block = buf.join("\n").trim();
    if (block) chunks.push(block);
    buf = [];
    capturing = false;
  };

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      flush();
      capturing = FLOW_HINT_SECTION_RE.test(line);
      if (capturing) buf.push(line);
      continue;
    }
    if (capturing) buf.push(line);
  }
  flush();

  if (chunks.length === 0) return null;
  let joined = chunks.join("\n\n---\n\n").trim();
  if (joined.length > FLOW_HINTS_MAX_CHARS) {
    joined = `${joined.slice(0, FLOW_HINTS_MAX_CHARS)}\n\n[… secções truncadas para runtime …]`;
  }
  return joined;
}

function selectPromptFromMarkdown(md: string): {
  prompt: string;
  mode: PublishedPlaybookMode;
} | null {
  const promptUnificado = extractPromptUnificado(md);
  if (promptUnificado) {
    return { prompt: sanitizePlaybookForRuntime(promptUnificado), mode: "prompt_unificado" };
  }

  const runtimeCore = extractRuntimeCore(md);
  if (runtimeCore) {
    return { prompt: sanitizePlaybookForRuntime(runtimeCore), mode: "runtime_core" };
  }

  const full = trimMarkdownBody(md);
  if (full) {
    return { prompt: sanitizePlaybookForRuntime(full), mode: "full_markdown" };
  }

  return null;
}

async function downloadMarkdownFromStorage(
  supabase: SupabaseClient,
  meta: PlaybookMeta
): Promise<{ ok: true; markdown: string; path: string } | { ok: false; detail: string }> {
  const path = String(meta.playbook_object_path || "").trim();
  if (path) {
    const { data, error } = await supabase.storage.from(PLAYBOOK_BUCKET).download(path);
    if (error || !data) {
      return { ok: false, detail: error?.message || "Falha ao descarregar playbook do bucket." };
    }
    const markdown = await data.text();
    return { ok: true, markdown, path };
  }

  const publicUrl = String(meta.playbook_public_url || "").trim();
  if (!publicUrl) {
    return { ok: false, detail: "Agente sem playbook_object_path nem playbook_public_url." };
  }
  const res = await fetch(publicUrl, { method: "GET" });
  if (!res.ok) {
    return { ok: false, detail: `HTTP ${res.status} ao ler playbook_public_url.` };
  }
  const markdown = await res.text();
  return { ok: true, markdown, path: publicUrl };
}

export async function loadPublishedPlaybookRuntimeSource(
  supabase: SupabaseClient,
  agenteSlug: string,
  meta: PlaybookMeta
): Promise<PublishedPlaybookLoadResult> {
  const hasRef = Boolean(
    String(meta.playbook_object_path || "").trim() || String(meta.playbook_public_url || "").trim()
  );
  if (!hasRef) {
    return { ok: false, reason: "missing_meta" };
  }

  const key = cacheKey(meta, agenteSlug);
  const hit = publishedPlaybookCache.get(key);
  if (hit && hit.expireAt > Date.now()) {
    return hit.result;
  }

  const downloaded = await downloadMarkdownFromStorage(supabase, meta);
  if (!downloaded.ok) {
    return { ok: false, reason: "download_error", detail: downloaded.detail };
  }

  const selected = selectPromptFromMarkdown(downloaded.markdown);
  if (!selected) {
    return { ok: false, reason: "empty_file", detail: "Playbook publicado está vazio." };
  }

  const flowHints = extractRuntimeFlowHints(downloaded.markdown);

  const result: Extract<PublishedPlaybookLoadResult, { ok: true }> = {
    ok: true,
    prompt: selected.prompt,
    rawMarkdown: downloaded.markdown,
    path: downloaded.path,
    hash: meta.playbook_source_hash != null ? String(meta.playbook_source_hash) : null,
    mode: selected.mode,
    flowHints,
  };
  publishedPlaybookCache.set(key, {
    expireAt: Date.now() + CACHE_TTL_MS,
    result,
  });
  return result;
}
