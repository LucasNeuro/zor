"use client";

import type {
  PlaybookFlowHandoffTarget,
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowDefinition,
  PlaybookFlowStep,
  PlaybookFlowStepKind,
  PlaybookFlowTransferKind,
} from "@/lib/playbook/flow-definition-types";

/** Tipos visuais no React Flow (transfer serializa como complete no JSON). */
export type FlowNodeKind = Extract<PlaybookFlowStepKind, "message" | "input" | "menu" | "complete"> | "transfer";

export type FlowMenuOption = {
  id: string;
  label: string;
};

export type FlowVisualNodeData = Record<string, unknown> & {
  kind: FlowNodeKind;
  title?: string;
  content: string;
  journey?: PlaybookFlowJourney;
  field?: string;
  inputType?: PlaybookFlowInputType;
  /** Only for menu nodes: list of option labels (ids match edge option ids) */
  menuOptions?: FlowMenuOption[];
  /** Step id for stable reference */
  stepId?: string;
  /** Não alcançável a partir do passo de entrada */
  isOrphan?: boolean;
  /** Nó transfer — mapeado para complete.handoff + metadata */
  transferKind?: PlaybookFlowTransferKind;
  handoffTo?: PlaybookFlowHandoffTarget;
  notifyPhone?: string;
  notifyEmail?: string;
  agentSlug?: string;
};

export type FlowCanvasSnapshot = {
  definition: PlaybookFlowDefinition;
  nodeCount: number;
  edgeCount: number;
};

const DEFAULT_CONTENT: Record<FlowNodeKind, string> = {
  message: "Mensagem inicial do atendimento.",
  input: "Pergunta para captar um dado do lead.",
  menu: "Escolha uma opção para continuar.",
  complete: "Fluxo concluído.",
  transfer: "Transferir atendimento. Resumo e contato do lead vão para o WhatsApp do consultor; conversa segue no CRM.",
};

export function summarizeNodeContent(content: string, max = 64): string {
  const clean = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Sem conteúdo";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function createDefaultNodeData(kind: FlowNodeKind, order: number): FlowVisualNodeData {
  const id = `step_${order}`;
  return {
    kind,
    title: `${capitalize(kind)} ${order}`,
    content: DEFAULT_CONTENT[kind],
    field: kind === "input" ? `${id}_value` : kind === "menu" ? id : undefined,
    inputType: kind === "input" ? "text" : undefined,
    menuOptions: kind === "menu" ? [{ id: "opcao_1", label: "Opção 1" }] : undefined,
    transferKind: kind === "transfer" ? "whatsapp_card" : undefined,
  };
}

export function toVisualNodeData(step: PlaybookFlowStep): FlowVisualNodeData {
  if (step.kind === "message") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.message,
      journey: step.journey,
      stepId: step.id,
    };
  }
  if (step.kind === "input") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.prompt,
      journey: step.journey,
      field: step.field,
      inputType: step.input_type ?? "text",
      stepId: step.id,
    };
  }
  if (step.kind === "menu") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.prompt,
      journey: step.journey,
      field: step.field ?? step.id,
      menuOptions: step.options.map((o) => ({ id: o.id, label: o.label })),
      stepId: step.id,
    };
  }
  if (step.kind === "complete") {
    const meta = step.complete.crm_patch?.metadata;
    const notifyPhone =
      meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).notify_phone === "string"
        ? String((meta as Record<string, unknown>).notify_phone)
        : undefined;
    const transferKind =
      meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).transfer_kind === "string"
        ? ((meta as Record<string, unknown>).transfer_kind as PlaybookFlowTransferKind)
        : undefined;
    if (transferKind || notifyPhone || step.complete.handoff_to) {
      return {
        kind: "transfer",
        title: step.title,
        content: step.complete.summary ?? "Transferência",
        stepId: step.id,
        transferKind: notifyPhone ? "whatsapp_card" : transferKind ?? "whatsapp_card",
        handoffTo: step.complete.handoff_to,
        notifyPhone,
        notifyEmail:
          typeof (meta as Record<string, unknown> | undefined)?.notify_email === "string"
            ? String((meta as Record<string, unknown>).notify_email)
            : undefined,
        agentSlug:
          typeof (meta as Record<string, unknown> | undefined)?.agent_slug === "string"
            ? String((meta as Record<string, unknown>).agent_slug)
            : undefined,
      };
    }
    return {
      kind: step.kind,
      title: step.title,
      content: step.complete.summary ?? "Fluxo concluído",
      stepId: step.id,
    };
  }
  const fallbackId = (step as PlaybookFlowStep).id ?? "step_unknown";
  return {
    kind: "complete",
    title: (step as PlaybookFlowStep).title,
    content: "Fluxo concluído",
    stepId: fallbackId,
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
