import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { PlaybookFlowStep } from "./flow-definition-types";
import {
  edgeId,
  flowDefinitionToGraph,
  graphToFlowDefinition,
  type FlowGraphEdge,
  type FlowGraphEdgeKind,
  type FlowVisualGraph,
} from "./flow-visual";
import type { FlowVisualNodeData } from "@/components/crm/playbook-flow-visual/types";
import { toVisualNodeData } from "@/components/crm/playbook-flow-visual/types";

export type { FlowVisualNodeData };

const START_X = 80;
const START_Y = 60;
const X_STEP = 240;
const Y_STEP = 120;

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyVisualDataToStep(step: PlaybookFlowStep, data: FlowVisualNodeData): void {
  if (data.title?.trim()) {
    step.title = data.title.trim();
  }
  if (step.kind === "message") {
    step.message = data.content;
    return;
  }
  if (step.kind === "input") {
    step.prompt = data.content;
    return;
  }
  if (step.kind === "menu") {
    step.prompt = data.content;
    return;
  }
  if (step.kind === "complete") {
    step.complete = { type: "complete", summary: data.content };
  }
}

function stepFromVisualNode(id: string, data: FlowVisualNodeData): PlaybookFlowStep {
  const title = data.title?.trim() || undefined;
  if (data.kind === "message") {
    return { id, kind: "message", title, message: data.content, next: "" };
  }
  if (data.kind === "input") {
    return {
      id,
      kind: "input",
      title,
      field: `${id}_value`,
      prompt: data.content,
      input_type: "text",
      next: "",
    };
  }
  if (data.kind === "menu") {
    return {
      id,
      kind: "menu",
      title,
      prompt: data.content,
      field: id,
      options: [{ id: "opcao_1", label: "Opção 1", next: "" }],
    };
  }
  return {
    id,
    kind: "complete",
    title,
    complete: { type: "complete", summary: data.content },
  };
}

function parseMenuOptionId(edge: Edge, step: PlaybookFlowStep & { kind: "menu" }): string | undefined {
  const parts = edge.id.split("__");
  if (parts.length >= 3 && parts[0] === edge.source) {
    const candidate = parts[parts.length - 1]?.trim();
    if (candidate && step.options.some((o) => o.id === candidate)) {
      return candidate;
    }
  }
  const label = String(edge.label ?? "").trim().toLowerCase();
  if (label) {
    const byLabel = step.options.find((o) => o.label.trim().toLowerCase() === label);
    if (byLabel) return byLabel.id;
  }
  return step.options[0]?.id;
}

function reactFlowEdgeToGraphEdge(
  edge: Edge,
  sourceStep: PlaybookFlowStep | undefined
): FlowGraphEdge | null {
  const from = edge.source?.trim();
  const to = edge.target?.trim();
  if (!from || !to) return null;

  if (sourceStep?.kind === "menu") {
    const optionId = parseMenuOptionId(edge, sourceStep);
    if (!optionId) return null;
    return {
      id: edgeId("option_next", from, to, optionId),
      from,
      to,
      kind: "option_next",
      option_id: optionId,
    };
  }

  return {
    id: edgeId("next", from, to),
    from,
    to,
    kind: "next",
  };
}

export function flowGraphToReactFlowElements(graph: FlowVisualGraph): {
  nodes: Array<Node<FlowVisualNodeData>>;
  edges: Edge[];
} {
  const nodes: Array<Node<FlowVisualNodeData>> = graph.nodes.map((node, index) => ({
    id: node.id,
    type: "default",
    position: node.position ?? {
      x: START_X + (index % 3) * X_STEP,
      y: START_Y + Math.floor(index / 3) * Y_STEP,
    },
    data: toVisualNodeData(node.step),
  }));

  const edges: Edge[] = [];
  for (const graphEdge of graph.edges) {
    const markerEnd = { type: MarkerType.ArrowClosed };
    if (graphEdge.kind === "next") {
      edges.push({
        id: graphEdge.id,
        source: graphEdge.from,
        target: graphEdge.to,
        markerEnd,
      });
      continue;
    }
    if (graphEdge.kind === "option_next" && graphEdge.option_id) {
      const step = graph.nodes.find((n) => n.id === graphEdge.from)?.step;
      const label =
        step?.kind === "menu"
          ? step.options.find((o) => o.id === graphEdge.option_id)?.label
          : undefined;
      edges.push({
        id: graphEdge.id,
        source: graphEdge.from,
        target: graphEdge.to,
        label,
        markerEnd,
      });
    }
  }

  return { nodes, edges };
}

export function reactFlowElementsToFlowGraph(
  baseGraph: FlowVisualGraph,
  rfNodes: Array<Node<FlowVisualNodeData>>,
  rfEdges: Edge[]
): FlowVisualGraph {
  const baseById = new Map(baseGraph.nodes.map((node) => [node.id, node]));

  const nodes = rfNodes.map((rfNode) => {
    const base = baseById.get(rfNode.id);
    const step = base ? deepClone(base.step) : stepFromVisualNode(rfNode.id, rfNode.data);
    applyVisualDataToStep(step, rfNode.data);
    return {
      id: rfNode.id,
      step,
      position: { x: rfNode.position.x, y: rfNode.position.y },
    };
  });

  const stepById = new Map(nodes.map((node) => [node.id, node.step]));
  const edges: FlowGraphEdge[] = [];
  const seen = new Set<string>();

  for (const rfEdge of rfEdges) {
    const sourceStep = stepById.get(rfEdge.source);
    const graphEdge = reactFlowEdgeToGraphEdge(rfEdge, sourceStep);
    if (!graphEdge || seen.has(graphEdge.id)) continue;
    seen.add(graphEdge.id);
    edges.push(graphEdge);
  }

  return {
    entry_step_id: baseGraph.entry_step_id,
    nodes,
    edges,
  };
}

export function reactFlowSnapshotToFlowDefinition(
  baseGraph: FlowVisualGraph,
  baseMeta: {
    schema_version?: import("./flow-definition-types").Obra10PlaybookFlowSchemaVersion;
    id?: string;
    version?: string;
    journeys?: import("./flow-definition-types").PlaybookFlowJourney[];
  },
  rfNodes: Array<Node<FlowVisualNodeData>>,
  rfEdges: Edge[]
) {
  const graph = reactFlowElementsToFlowGraph(baseGraph, rfNodes, rfEdges);
  return graphToFlowDefinition(graph, {
    ...baseMeta,
    entry_step_id: baseGraph.entry_step_id,
    validate: false,
  });
}

export function flowDefinitionToReactFlowElements(definition: import("./flow-definition-types").PlaybookFlowDefinition) {
  return flowGraphToReactFlowElements(flowDefinitionToGraph(definition));
}
