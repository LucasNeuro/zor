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

function selectPromptFromMarkdown(md: string): {
  prompt: string;
  mode: PublishedPlaybookMode;
} | null {
  const promptUnificado = extractPromptUnificado(md);
  if (promptUnificado) {
    return { prompt: promptUnificado, mode: "prompt_unificado" };
  }

  const runtimeCore = extractRuntimeCore(md);
  if (runtimeCore) {
    return { prompt: runtimeCore, mode: "runtime_core" };
  }

  const full = trimMarkdownBody(md);
  if (full) {
    return { prompt: full, mode: "full_markdown" };
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

  const result: Extract<PublishedPlaybookLoadResult, { ok: true }> = {
    ok: true,
    prompt: selected.prompt,
    rawMarkdown: downloaded.markdown,
    path: downloaded.path,
    hash: meta.playbook_source_hash != null ? String(meta.playbook_source_hash) : null,
    mode: selected.mode,
  };
  publishedPlaybookCache.set(key, {
    expireAt: Date.now() + CACHE_TTL_MS,
    result,
  });
  return result;
}
