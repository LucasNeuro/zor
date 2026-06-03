"use client";

import type {
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowDefinition,
  PlaybookFlowStep,
  PlaybookFlowStepKind,
} from "@/lib/playbook/flow-definition-types";

export type FlowNodeKind = Extract<PlaybookFlowStepKind, "message" | "input" | "menu" | "complete">;

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
  return {
    kind: step.kind,
    title: step.title,
    content: step.complete.summary ?? "Fluxo concluído",
    journey: step.journey,
    stepId: step.id,
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
