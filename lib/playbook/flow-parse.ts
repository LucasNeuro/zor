import type { PlaybookFlowDefinition } from "./flow-definition-types";

type ParsedWithSource = {
  parsed: unknown;
  source: "tagged_fence" | "generic_fence";
};

export type ParsePlaybookFlowResult =
  | {
      ok: true;
      definition: PlaybookFlowDefinition;
      source: "tagged_fence" | "generic_fence";
    }
  | { ok: false; reason: "not_found" | "invalid_json" | "missing_schema"; errors: string[] };

/** Captura a linha de abertura inteira (ex.: `json obra10_playbook_flow`). */
const FENCED_CODE_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g;

function parseJsonSafe(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasSchemaMarker(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.prototype.hasOwnProperty.call(value, "obra10_playbook_flow_schema");
}

function normalizeFenceInfo(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function isObra10PlaybookFlowFence(info: string): boolean {
  const normalized = normalizeFenceInfo(info);
  if (!normalized) return false;
  if (normalized === "obra10_playbook_flow") return true;
  if (normalized.includes("obra10_playbook_flow")) return true;
  return false;
}

function extractFencedJsonBlocks(markdown: string): Array<{ info: string; code: string }> {
  const blocks: Array<{ info: string; code: string }> = [];
  for (const match of markdown.matchAll(FENCED_CODE_BLOCK_RE)) {
    const info = (match[1] || "").trim();
    const code = (match[2] || "").trim();
    if (!code) continue;
    blocks.push({ info, code });
  }
  return blocks;
}

function findTaggedFence(markdown: string): ParsedWithSource | null {
  const blocks = extractFencedJsonBlocks(markdown);
  for (const block of blocks) {
    if (!isObra10PlaybookFlowFence(block.info)) continue;
    const parsed = parseJsonSafe(block.code);
    if (!parsed) {
      return {
        parsed: null,
        source: "tagged_fence",
      };
    }
    return { parsed, source: "tagged_fence" };
  }
  return null;
}

function findFallbackSchemaBlock(markdown: string): ParsedWithSource | null {
  const blocks = extractFencedJsonBlocks(markdown);
  for (const block of blocks) {
    const maybeJson = parseJsonSafe(block.code);
    if (!hasSchemaMarker(maybeJson)) continue;
    return { parsed: maybeJson, source: "generic_fence" };
  }
  return null;
}

/**
 * Extrai definição de fluxo em markdown.
 * Preferência: bloco fenced com lang `obra10_playbook_flow`.
 * Fallback: primeiro fenced block JSON que contenha `obra10_playbook_flow_schema`.
 */
export function parsePlaybookFlowFromMarkdown(markdown: string): ParsePlaybookFlowResult {
  if (typeof markdown !== "string" || !markdown.trim()) {
    return {
      ok: false,
      reason: "not_found",
      errors: ["Markdown vazio: não foi possível localizar bloco de fluxo."],
    };
  }

  const tagged = findTaggedFence(markdown);
  if (tagged) {
    if (!tagged.parsed) {
      return {
        ok: false,
        reason: "invalid_json",
        errors: [
          "Bloco `obra10_playbook_flow` encontrado, mas o JSON está inválido.",
          "Revise vírgulas, aspas duplas e chaves do bloco fenced.",
        ],
      };
    }
    if (!hasSchemaMarker(tagged.parsed)) {
      return {
        ok: false,
        reason: "missing_schema",
        errors: [
          "Bloco `obra10_playbook_flow` não contém `obra10_playbook_flow_schema`.",
          "Inclua o campo de schema para validar o fluxo dinâmico.",
        ],
      };
    }
    return {
      ok: true,
      definition: tagged.parsed as PlaybookFlowDefinition,
      source: tagged.source,
    };
  }

  const fallback = findFallbackSchemaBlock(markdown);
  if (fallback) {
    return {
      ok: true,
      definition: fallback.parsed as PlaybookFlowDefinition,
      source: fallback.source,
    };
  }

  return {
    ok: false,
    reason: "not_found",
    errors: ["Nenhum bloco de fluxo encontrado no markdown (`obra10_playbook_flow_schema`)."],
  };
}
