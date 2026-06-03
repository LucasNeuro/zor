import type { PlaybookFlowDefinition } from "./flow-definition-types";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";

const FLOW_SECTION_RE = /\n---\n\n## Bloco de fluxo din[aá]mico[\s\S]*$/i;
const FLOW_FENCE_RE = /```[^\n]*obra10_playbook_flow[^\n]*\n[\s\S]*?```/i;
const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/;
const MARKDOWN_HEADING_RE = /(^|\n)#{1,6}\s+\S/;

export type AdaptarMarkdownMotorWhatsappResult =
  | { ok: true; markdown: string; action: "appended_flow"; message: string }
  | { ok: true; markdown: string; action: "replaced_flow"; message: string }
  | { ok: false; error: string };

function looksLikeStructuredMarkdown(text: string): boolean {
  return FRONTMATTER_RE.test(text) || MARKDOWN_HEADING_RE.test(text);
}

function buildMarkdownFromPlainText(raw: string): string {
  const body = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return `---
obra10_playbook_schema: 1
---

# Playbook — Rascunho calibracao

## Prompt unificado

${body}
`;
}

/**
 * Mantém o corpo narrativo (prompt/cargo) e acrescenta ou preserva o bloco
 * `obra10_playbook_flow` exigido pelo motor determinístico do WhatsApp.
 */
export function adaptarMarkdownParaMotorWhatsapp(
  narrativeMarkdown: string,
  templateMarkdownComFluxo: string
): AdaptarMarkdownMotorWhatsappResult {
  const current = String(narrativeMarkdown ?? "").trim();
  if (!current) {
    return { ok: false, error: "O editor está vazio. Cole ou carregue o playbook antes de adaptar." };
  }

  const template = String(templateMarkdownComFluxo ?? "").trim();
  if (!template) {
    return { ok: false, error: "Template de fluxo vazio." };
  }

  const flowTemplate = parsePlaybookFlowFromMarkdown(template);
  if (!flowTemplate.ok) {
    return {
      ok: false,
      error:
        flowTemplate.errors[0] ??
        "O template não contém bloco `json obra10_playbook_flow` com schema v1.",
    };
  }

  const validatedTemplate = validatePlaybookFlowDefinition(flowTemplate.definition);
  if (!validatedTemplate.ok) {
    return {
      ok: false,
      error: validatedTemplate.errors[0] ?? "Fluxo do template inválido.",
    };
  }

  const narrativeBase = looksLikeStructuredMarkdown(current)
    ? current
    : buildMarkdownFromPlainText(current);

  const hadValidFlow = (() => {
    const parsed = parsePlaybookFlowFromMarkdown(narrativeBase);
    if (!parsed.ok) return false;
    return validatePlaybookFlowDefinition(parsed.definition).ok;
  })();
  const base = narrativeBase.replace(FLOW_SECTION_RE, "").trimEnd();
  const markdown = base + renderPlaybookFlowBlockToMarkdown(validatedTemplate.definition);

  return {
    ok: true,
    markdown,
    action: hadValidFlow ? "replaced_flow" : "appended_flow",
    message: hadValidFlow
      ? "Bloco de fluxo WhatsApp substituído pelo template atual. Revise, analise e publique."
      : "Bloco de fluxo WhatsApp (obra10_playbook_flow) adicionado ao final. Revise, analise e publique.",
  };
}

export function renderPlaybookFlowBlockToMarkdown(definition: PlaybookFlowDefinition): string {
  return `\n\n---\n\n## Bloco de fluxo dinamico (obrigatorio para WhatsApp)\n\n\`\`\`json obra10_playbook_flow\n${JSON.stringify(definition, null, 2)}\n\`\`\`\n`;
}

function renderPlaybookFlowFence(definition: PlaybookFlowDefinition): string {
  return `\`\`\`json obra10_playbook_flow\n${JSON.stringify(definition, null, 2)}\n\`\`\``;
}

/**
 * Atualiza apenas o fence `json obra10_playbook_flow` quando já existe;
 * caso não exista, anexa o bloco dinâmico completo ao final.
 */
export function upsertPlaybookFlowBlockInMarkdown(
  markdown: string,
  definition: PlaybookFlowDefinition
): string {
  const source = String(markdown ?? "");
  const fence = renderPlaybookFlowFence(definition);
  if (FLOW_FENCE_RE.test(source)) {
    return source.replace(FLOW_FENCE_RE, fence);
  }
  return `${source.trimEnd()}${renderPlaybookFlowBlockToMarkdown(definition)}`;
}

/**
 * Ao regenerar o playbook (pipeline Hub), preserva o bloco `obra10_playbook_flow`
 * que já existia no ficheiro publicado — o render determinístico só gera `obra10_playbook_schema`.
 */
export function mergePlaybookMarkdownPreservingFlow(
  newBody: string,
  previousMarkdown: string | null | undefined
): { markdown: string; preservedFlow: boolean } {
  const base = newBody.replace(FLOW_SECTION_RE, "").trimEnd();
  if (!previousMarkdown?.trim()) {
    return { markdown: base, preservedFlow: false };
  }
  const parsed = parsePlaybookFlowFromMarkdown(previousMarkdown);
  if (!parsed.ok) {
    return { markdown: base, preservedFlow: false };
  }
  return {
    markdown: upsertPlaybookFlowBlockInMarkdown(base, parsed.definition),
    preservedFlow: true,
  };
}
