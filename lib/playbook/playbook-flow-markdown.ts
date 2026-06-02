import type { PlaybookFlowDefinition } from "./flow-definition-types";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";

const FLOW_SECTION_RE = /\n---\n\n## Bloco de fluxo din[aá]mico[\s\S]*$/i;

export type AdaptarMarkdownMotorWhatsappResult =
  | { ok: true; markdown: string; action: "already_ready"; message: string }
  | { ok: true; markdown: string; action: "appended_flow"; message: string }
  | { ok: false; error: string };

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

  const flowAtual = parsePlaybookFlowFromMarkdown(current);
  if (flowAtual.ok) {
    const validated = validatePlaybookFlowDefinition(flowAtual.definition);
    if (validated.ok) {
      return {
        ok: true,
        markdown: current,
        action: "already_ready",
        message: "O rascunho já contém um bloco de fluxo WhatsApp válido (schema v1).",
      };
    }
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

  const base = current.replace(FLOW_SECTION_RE, "").trimEnd();
  const markdown = base + renderPlaybookFlowBlockToMarkdown(validatedTemplate.definition);

  return {
    ok: true,
    markdown,
    action: "appended_flow",
    message:
      "Bloco de fluxo WhatsApp (obra10_playbook_flow) adicionado ao final. Revise, analise e publique.",
  };
}

export function renderPlaybookFlowBlockToMarkdown(definition: PlaybookFlowDefinition): string {
  return `\n\n---\n\n## Bloco de fluxo dinamico (obrigatorio para WhatsApp)\n\n\`\`\`json obra10_playbook_flow\n${JSON.stringify(definition, null, 2)}\n\`\`\`\n`;
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
    markdown: base + renderPlaybookFlowBlockToMarkdown(parsed.definition),
    preservedFlow: true,
  };
}
