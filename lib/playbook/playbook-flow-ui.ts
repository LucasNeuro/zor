import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";

export type PlaybookFlowUiStatus =
  | { kind: "empty" }
  | { kind: "no_flow_block"; message: string }
  | { kind: "invalid"; errors: string[]; reason?: string }
  | { kind: "ready"; entryStepId: string; stepCount: number };

export function assessPlaybookFlowInMarkdown(markdown: string): PlaybookFlowUiStatus {
  const trimmed = markdown.trim();
  if (!trimmed) return { kind: "empty" };

  const parsed = parsePlaybookFlowFromMarkdown(trimmed);
  if (!parsed.ok) {
    if (parsed.reason === "not_found") {
      return {
        kind: "no_flow_block",
        message:
          "Este playbook ainda não tem bloco de fluxo dinâmico. Adicione no final um bloco fenced `json waje_playbook_flow` com `waje_playbook_flow_schema: 1` para menus e passos no WhatsApp.",
      };
    }
    return { kind: "invalid", errors: parsed.errors, reason: parsed.reason };
  }

  const validated = validatePlaybookFlowDefinition(parsed.definition);
  if (!validated.ok) {
    return { kind: "invalid", errors: validated.errors };
  }

  return {
    kind: "ready",
    entryStepId: validated.definition.entry_step_id,
    stepCount: validated.definition.steps.length,
  };
}

export function playbookFlowReady(status: PlaybookFlowUiStatus): boolean {
  return status.kind === "ready";
}
