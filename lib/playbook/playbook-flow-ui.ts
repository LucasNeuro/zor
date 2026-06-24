import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";
import { PLAYBOOK_FLOW_FENCE_TAG } from "./flow-schema";

/** Fluxo dinâmico (menus/perguntas) aplica-se só a agentes WhatsApp. */
export function agenteUsaFluxoWhatsappPlaybook(modoOperacao: string | null | undefined): boolean {
  return modoOperacao === "canal_whatsapp";
}

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
          `Blocos de fluxo organizam menus e passos fixos no WhatsApp (não usam IA). A IA do agente continua livre fora do fluxo. Use «Gerar fluxo» (fonte: docs da empresa e do agente) ou «Editor visual» → «Iniciar em branco».`,
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
