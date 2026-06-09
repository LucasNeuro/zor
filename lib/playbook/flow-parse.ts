import type { PlaybookFlowDefinition } from "./flow-definition-types";
import {
  hasPlaybookFlowSchemaMarker,
  isPlaybookFlowFenceTag,
  normalizePlaybookFlowDefinition,
} from "./flow-schema";

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

/** Captura a linha de abertura inteira (ex.: `json waje_playbook_flow`). */
const FENCED_CODE_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g;

function parseJsonSafe(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    if (!isPlaybookFlowFenceTag(block.info)) continue;
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
    if (!hasPlaybookFlowSchemaMarker(maybeJson)) continue;
    return { parsed: maybeJson, source: "generic_fence" };
  }
  return null;
}

/**
 * Extrai definição de fluxo em markdown.
 * Preferência: bloco fenced `waje_playbook_flow` (ou legado `obra10_playbook_flow`).
 * Fallback: primeiro fenced block JSON que contenha schema de fluxo.
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
          "Bloco de fluxo encontrado, mas o JSON está inválido.",
          "Revise vírgulas, aspas duplas e chaves do bloco fenced.",
        ],
      };
    }
    if (!hasPlaybookFlowSchemaMarker(tagged.parsed)) {
      return {
        ok: false,
        reason: "missing_schema",
        errors: [
          "Bloco de fluxo não contém `waje_playbook_flow_schema` (ou legado obra10).",
          "Inclua o campo de schema para validar o fluxo dinâmico.",
        ],
      };
    }
    return {
      ok: true,
      definition: normalizePlaybookFlowDefinition(
        tagged.parsed as Record<string, unknown>
      ) as PlaybookFlowDefinition,
      source: tagged.source,
    };
  }

  const fallback = findFallbackSchemaBlock(markdown);
  if (fallback) {
    return {
      ok: true,
      definition: normalizePlaybookFlowDefinition(
        fallback.parsed as Record<string, unknown>
      ) as PlaybookFlowDefinition,
      source: fallback.source,
    };
  }

  return {
    ok: false,
    reason: "not_found",
    errors: ["Nenhum bloco de fluxo encontrado no markdown (`waje_playbook_flow_schema`)."],
  };
}
