"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import {
  CheckCircle2,
  List,
  LocateFixed,
  MessageSquare,
  PencilLine,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import type {
  PlaybookFlowCompleteAction,
  PlaybookFlowDefinition,
  PlaybookFlowInputType,
  PlaybookFlowMenuOption,
  PlaybookFlowTransferKind,
} from "@/lib/playbook/flow-definition-types";
import {
  FLOW_NODE_TYPES,
  FlowNodeCallbacksContext,
} from "./FlowCustomNodes";
import {
  createDefaultNodeData,
  toVisualNodeData,
  type FlowCanvasSnapshot,
  type FlowNodeKind,
  type FlowVisualNodeData,
} from "./types";
import { FlowNodeEditorSideover } from "./FlowNodeEditorSideover";

const NODE_TYPES: NodeTypes = FLOW_NODE_TYPES as NodeTypes;

const CANVAS_MIN_H = 480;
const READABLE_MIN_ZOOM = 0.25;
/** Zoom confortável só para fluxos com poucos nós. */
const SMALL_FLOW_MIN_ZOOM = 0.58;
const ENTRY_FOCUS_ZOOM = 0.65;

function scheduleViewportFit(
  instance: {
    fitView: (opts?: {
      padding?: number;
      duration?: number;
      minZoom?: number;
      maxZoom?: number;
    }) => Promise<boolean> | boolean;
    getZoom?: () => number;
    zoomTo?: (zoom: number, opts?: { duration?: number }) => void;
  },
  host: HTMLElement | null,
  attempt = 0,
  nodeCount = 1
) {
  const rect = host?.getBoundingClientRect();
  if (!rect || rect.width < 40 || rect.height < 80) {
    if (attempt < 24) {
      requestAnimationFrame(() => scheduleViewportFit(instance, host, attempt + 1, nodeCount));
    }
    return;
  }
  void instance.fitView({
    padding: 0.14,
    duration: attempt > 0 ? 200 : 0,
    minZoom: READABLE_MIN_ZOOM,
    maxZoom: 1.2,
  });
  const zoom = instance.getZoom?.() ?? 1;
  // Só amplia fluxos pequenos; não força zoom alto em fluxos grandes (evita board “quebrado”).
  if (nodeCount <= 4 && zoom < 0.5) {
    instance.zoomTo?.(SMALL_FLOW_MIN_ZOOM, { duration: 0 });
  } else if (zoom < 0.22) {
    instance.zoomTo?.(0.32, { duration: 0 });
  }
}

// ─── Auto-layout (BFS topological) ───────────────────────────────────────────

const NODE_W = 300;
const NODE_H_EST = 230;
const H_GAP = 132;
const V_GAP = 92;
const MENU_BASE_EXTRA_H = 28;
const MENU_OPTION_EXTRA_H = 30;
const MENU_OPTION_HEIGHT_CAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateNodeHeight(node?: Node<FlowVisualNodeData>): number {
  if (!node || node.data.kind !== "menu") return NODE_H_EST;
  const rawOptions = Array.isArray(node.data.menuOptions) ? node.data.menuOptions.length : 0;
  const optionCount = Math.max(1, rawOptions);
  const boundedOptions = Math.min(optionCount, MENU_OPTION_HEIGHT_CAP);
  const extraOptions = Math.max(0, boundedOptions - 1);
  return NODE_H_EST + MENU_BASE_EXTRA_H + extraOptions * MENU_OPTION_EXTRA_H;
}

function getTopDownPosition(layerY: number, index: number, layerSize: number): { x: number; y: number } {
  const gap = H_GAP + Math.max(0, layerSize - 2) * 48;
  const layerWidth = Math.max(0, layerSize - 1) * (NODE_W + gap);
  const startX = -layerWidth / 2;
  return {
    x: startX + index * (NODE_W + gap),
    y: layerY,
  };
}

function formatMenuEdgeLabel(label: string, index: number): string {
  const trimmed = label.trim();
  const prefix = `${index + 1}`;
  if (!trimmed) return prefix;
  const max = 18;
  if (trimmed.length <= max) return `${prefix} · ${trimmed}`;
  return `${prefix} · ${trimmed.slice(0, max)}…`;
}

function findOrphanNodeIds(
  entryId: string,
  nodes: Array<Node<FlowVisualNodeData>>,
  edges: Edge[]
): Set<string> {
  const allIds = new Set(nodes.map((n) => n.id));
  if (!entryId || !allIds.has(entryId)) return new Set();

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!allIds.has(edge.source) || !allIds.has(edge.target)) continue;
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  const visited = new Set<string>();
  const queue = [entryId];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const next of outgoing.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  const orphans = new Set<string>();
  for (const id of allIds) {
    if (!visited.has(id)) orphans.add(id);
  }
  return orphans;
}

function applyOrphanFlags(
  nodes: Array<Node<FlowVisualNodeData>>,
  entryId: string,
  edges: Edge[]
): Array<Node<FlowVisualNodeData>> {
  const orphans = findOrphanNodeIds(entryId, nodes, edges);
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, isOrphan: orphans.has(node.id) },
  }));
}

function getNextVerticalPosition(nodes: Array<Node<FlowVisualNodeData>>): { x: number; y: number } {
  if (!nodes.length) return { x: 0, y: 0 };
  const maxBottom = Math.max(...nodes.map((node) => node.position.y + estimateNodeHeight(node)));
  return { x: 0, y: maxBottom + V_GAP };
}

function computeAutoLayout(
  nodes: Array<Node<FlowVisualNodeData>>,
  edges: Edge[],
  entryId?: string
): Array<Node<FlowVisualNodeData>> {
  if (!nodes.length) return nodes;

  const firstId = entryId ?? nodes[0]?.id ?? "";
  const allIds = new Set(nodes.map((n) => n.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of edges) {
    if (!allIds.has(edge.source) || !allIds.has(edge.target)) continue;
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
    const parents = incoming.get(edge.target) ?? [];
    parents.push(edge.source);
    incoming.set(edge.target, parents);
  }

  // Keep traversal stable for readability.
  for (const [id, targets] of outgoing) {
    const unique = [...new Set(targets)];
    unique.sort((a, b) => {
      const aTitle = String(nodeById.get(a)?.data?.title ?? "");
      const bTitle = String(nodeById.get(b)?.data?.title ?? "");
      return aTitle.localeCompare(bTitle) || a.localeCompare(b);
    });
    outgoing.set(id, unique);
  }

  for (const [id, parents] of incoming) {
    const unique = [...new Set(parents)];
    unique.sort((a, b) => {
      const aTitle = String(nodeById.get(a)?.data?.title ?? "");
      const bTitle = String(nodeById.get(b)?.data?.title ?? "");
      return aTitle.localeCompare(bTitle) || a.localeCompare(b);
    });
    incoming.set(id, unique);
  }

  const stableNodeOrder = [...nodes]
    .sort((a, b) => {
      const aTitle = String(a.data.title ?? "");
      const bTitle = String(b.data.title ?? "");
      return aTitle.localeCompare(bTitle) || a.id.localeCompare(b.id);
    })
    .map((node) => node.id);

  const depthById = new Map<string, number>();
  const visited = new Set<string>();
  const queue: string[] = firstId && allIds.has(firstId) ? [firstId] : [stableNodeOrder[0]];

  if (queue[0]) depthById.set(queue[0], 0);

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current) || !allIds.has(current)) continue;
    visited.add(current);
    const parentDepth = depthById.get(current) ?? 0;
    for (const target of outgoing.get(current) ?? []) {
      if (!depthById.has(target)) {
        depthById.set(target, parentDepth + 1);
      }
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  // Deterministic placement for nodes disconnected from entry.
  let maxDepth = Math.max(0, ...depthById.values());
  for (const id of stableNodeOrder) {
    if (!depthById.has(id)) {
      maxDepth += 1;
      depthById.set(id, maxDepth);
    }
  }

  const layers = new Map<number, string[]>();
  for (const id of stableNodeOrder) {
    const depth = depthById.get(id) ?? 0;
    const layer = layers.get(depth) ?? [];
    layer.push(id);
    layers.set(depth, layer);
  }

  const orderedDepths = [...layers.keys()].sort((a, b) => a - b);
  const finalLayerOrder = new Map<number, string[]>();
  const orderById = new Map<string, number>();

  for (const depth of orderedDepths) {
    const ids = [...(layers.get(depth) ?? [])];
    if (depth === 0) {
      ids.sort((a, b) => {
        if (a === firstId) return -1;
        if (b === firstId) return 1;
        return a.localeCompare(b);
      });
    } else {
      ids.sort((a, b) => {
        const aParents = incoming.get(a) ?? [];
        const bParents = incoming.get(b) ?? [];
        const aParentScore = aParents.length
          ? aParents.reduce((sum, parent) => sum + (orderById.get(parent) ?? 0), 0) / aParents.length
          : Number.POSITIVE_INFINITY;
        const bParentScore = bParents.length
          ? bParents.reduce((sum, parent) => sum + (orderById.get(parent) ?? 0), 0) / bParents.length
          : Number.POSITIVE_INFINITY;
        if (aParentScore !== bParentScore) return aParentScore - bParentScore;
        const aTitle = String(nodeById.get(a)?.data?.title ?? "");
        const bTitle = String(nodeById.get(b)?.data?.title ?? "");
        return aTitle.localeCompare(bTitle) || a.localeCompare(b);
      });
    }
    ids.forEach((id, index) => orderById.set(id, index));
    finalLayerOrder.set(depth, ids);
  }

  const yByDepth = new Map<number, number>();
  let nextLayerY = 0;
  for (const depth of orderedDepths) {
    yByDepth.set(depth, nextLayerY);
    const layer = finalLayerOrder.get(depth) ?? [];
    const layerMaxHeight = Math.max(
      NODE_H_EST,
      ...layer.map((id) => estimateNodeHeight(nodeById.get(id)))
    );
    nextLayerY += layerMaxHeight + V_GAP;
  }

  const positioned = new Map<string, { x: number; y: number }>();
  for (const depth of orderedDepths) {
    const layer = finalLayerOrder.get(depth) ?? [];
    const layerY = yByDepth.get(depth) ?? 0;
    layer.forEach((id, index) => {
      positioned.set(id, getTopDownPosition(layerY, index, layer.length));
    });
  }

  return nodes.map((node) => ({
            ...node,
    position: positioned.get(node.id) ?? { x: 0, y: 0 },
  }));
}

// ─── Build from definition ────────────────────────────────────────────────────

function buildInitialNodes(def?: PlaybookFlowDefinition): Array<Node<FlowVisualNodeData>> {
  if (!def?.steps?.length) {
    return [{
        id: "step_1",
      type: "message",
      position: { x: 0, y: 0 },
        data: createDefaultNodeData("message", 1),
    }];
  }
  return def.steps.map((step) => {
    const data = toVisualNodeData(step);
    return {
      id: step.id,
      type: data.kind,
      position: { x: 0, y: 0 },
      data,
    };
  });
}

function buildInitialEdges(def?: PlaybookFlowDefinition): Edge[] {
  if (!def?.steps?.length) return [];
  const edges: Edge[] = [];

  for (const step of def.steps) {
    if ((step.kind === "message" || step.kind === "input" || step.kind === "media") && step.next) {
      edges.push({
        id: `${step.id}__${step.next}`,
        source: step.id,
        target: step.next,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#7da8d6", strokeWidth: 2 },
        type: "smoothstep",
      });
    }
    if (step.kind === "menu") {
      step.options.forEach((opt, index) => {
        if (!opt.next) return;
        edges.push({
          id: `${step.id}__${opt.next}__${opt.id}`,
          source: step.id,
          sourceHandle: opt.id,
          target: opt.next,
          label: formatMenuEdgeLabel(opt.label, index),
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#a78bfa", strokeWidth: 2 },
          labelStyle: { fill: "#334155", fontSize: 10, fontFamily: "inherit", fontWeight: 700 },
          labelBgStyle: { fill: "#f8fafc", stroke: "#cbd5e1", strokeWidth: 1 },
          labelBgPadding: [5, 6] as [number, number],
          labelBgBorderRadius: 6,
          type: "smoothstep",
        });
      });
    }
    if (step.kind === "complete" && step.next) {
      edges.push({
        id: `${step.id}__${step.next}`,
        source: step.id,
        target: step.next,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#6366f1", strokeWidth: 2 },
        type: "smoothstep",
      });
    }
  }
  return edges;
}

// ─── definition from nodes + edges ───────────────────────────────────────────

function normalizeMenuOptionId(raw: string, index: number, used: Set<string>): string {
  const base = raw.trim() || `opcao_${index + 1}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  let candidate = `${base}_${i}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${base}_${i}`;
  }
  used.add(candidate);
  return candidate;
}

function extractOptionIdFromEdge(edge: Edge): string | null {
  const chunks = String(edge.id ?? "").split("__");
  if (chunks.length < 3) return null;
  const optionId = chunks.slice(2).join("__").trim();
  return optionId || null;
}

function mapMenuOptions(
  node: Node<FlowVisualNodeData>,
  nodeEdges: Edge[]
): PlaybookFlowMenuOption[] {
  const rawNodeOptions = Array.isArray(node.data.menuOptions)
    ? (node.data.menuOptions as Array<{ id?: string; label?: string }>)
    : [];
  const usedIds = new Set<string>();
  const configuredOptions = rawNodeOptions.map((opt, index) => ({
    id: normalizeMenuOptionId(String(opt.id ?? ""), index, usedIds),
    label: String(opt.label ?? "").trim() || `Opção ${index + 1}`,
  }));

  const configuredIds = new Set(configuredOptions.map((o) => o.id));
  const nextByOptionId = new Map<string, string>();
  const fallbackEdges: Edge[] = [];

  for (const edge of nodeEdges) {
    const optId = extractOptionIdFromEdge(edge);
    if (optId && configuredIds.has(optId) && !nextByOptionId.has(optId)) {
      nextByOptionId.set(optId, edge.target);
      continue;
    }
    fallbackEdges.push(edge);
  }

  for (const option of configuredOptions) {
    if (nextByOptionId.has(option.id)) continue;
    const fallback = fallbackEdges.shift();
    if (!fallback) continue;
    nextByOptionId.set(option.id, fallback.target);
  }

  const mappedConfigured: PlaybookFlowMenuOption[] = configuredOptions.map((option) => {
    const next = nextByOptionId.get(option.id)?.trim();
    if (next) {
      return {
        id: option.id,
        label: option.label,
        next,
      };
    }
    return {
      id: option.id,
      label: option.label,
      complete: {
        type: "complete",
        summary: `Fluxo encerrado após "${option.label}".`,
      },
    };
  });

  const extraOptions = fallbackEdges.map((edge, index) => {
    const id = normalizeMenuOptionId(`opcao_extra_${index + 1}`, index, usedIds);
    const label = String(edge.label ?? `Opção ${configuredOptions.length + index + 1}`);
    return {
      id,
      label: label.trim() || `Opção ${configuredOptions.length + index + 1}`,
      next: edge.target,
    };
  });

  const options = [...mappedConfigured, ...extraOptions];
  if (options.length > 0) return options;

  return [
    {
      id: "opcao_1",
      label: "Opção 1",
      complete: {
        type: "complete",
        summary: 'Fluxo encerrado após "Opção 1".',
      },
    },
  ];
}

function toDefinition(
  nodes: Array<Node<FlowVisualNodeData>>,
  edges: Edge[],
  preferredEntryStepId?: string
): PlaybookFlowDefinition {
  const nextBySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = nextBySource.get(edge.source) ?? [];
    list.push(edge);
    nextBySource.set(edge.source, list);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const entryStepId = preferredEntryStepId && nodeIds.has(preferredEntryStepId)
    ? preferredEntryStepId
    : (nodes[0]?.id ?? "step_1");

  return {
    obra10_playbook_flow_schema: 1,
    entry_step_id: entryStepId,
    steps: nodes.map((node) => {
      const nodeEdges = nextBySource.get(node.id) ?? [];
      const firstTarget = nodeEdges[0]?.target;
      const title = node.data.title?.trim() || undefined;

      if (node.data.kind === "message") {
        return {
          id: node.id,
          kind: "message",
          title,
          message: node.data.content,
          next: firstTarget,
        };
      }
      if (node.data.kind === "media") {
        return {
          id: node.id,
          kind: "media",
          title,
          media_type: node.data.mediaType ?? "image",
          file: String(node.data.mediaUrl ?? "").trim() || "https://",
          caption: node.data.content?.trim() || undefined,
          next: firstTarget,
        };
      }
      if (node.data.kind === "input") {
        return {
          id: node.id, kind: "input", title,
          field: String(node.data.field ?? `${node.id}_value`).trim() || `${node.id}_value`,
          prompt: node.data.content,
          input_type: (node.data.inputType as PlaybookFlowInputType | undefined) ?? "text",
          next: firstTarget,
        };
      }
      if (node.data.kind === "menu") {
        const options = mapMenuOptions(node, nodeEdges);
        return {
          id: node.id,
          kind: "menu",
          title,
          prompt: node.data.content,
          field: String(node.data.field ?? node.id).trim() || node.id,
          options,
        };
      }
      const completePayload = buildCompletePayload(node.data);
      return {
        id: node.id,
        kind: "complete",
        title,
        complete: completePayload,
        ...(firstTarget ? { next: firstTarget } : {}),
      };
    }),
  };
}

function buildCompletePayload(data: FlowVisualNodeData): PlaybookFlowCompleteAction {
  const metadata: Record<string, unknown> = {};
  const isTransfer = data.kind === "transfer";
  const notifyPhone = data.notifyPhone?.trim();
  const transferKind = isTransfer
    ? notifyPhone
      ? "whatsapp_card"
      : (data.transferKind as PlaybookFlowTransferKind | undefined) ?? "whatsapp_card"
    : notifyPhone
      ? "whatsapp_card"
      : (data.transferKind as PlaybookFlowTransferKind | undefined);
  if (transferKind) metadata.transfer_kind = transferKind;
  if (notifyPhone) metadata.notify_phone = notifyPhone;
  if (data.notifyEmail?.trim()) metadata.notify_email = data.notifyEmail.trim();
  if (data.agentSlug?.trim()) metadata.agent_slug = data.agentSlug.trim();

  return {
    type: "complete",
    handoff_to: isTransfer || transferKind ? "time_humano" : data.handoffTo,
    summary: data.content,
    ...(Object.keys(metadata).length > 0 ? { crm_patch: { metadata } } : {}),
  };
}

function connectionId(c: Connection): string {
  return `${c.source ?? "src"}__${c.target ?? "tgt"}__${Date.now()}`;
}

// ─── FlowCanvasInner ──────────────────────────────────────────────────────────

export type FlowCanvasApi = {
  addNode: (kind: FlowNodeKind) => void;
  fitCanvas: () => void;
  /** Aplica alterações pendentes do canvas (ex.: antes de salvar). */
  flushAndSnapshot: () => FlowCanvasSnapshot | null;
};

type FlowCanvasProps = {
  initialDefinition?: PlaybookFlowDefinition;
  initialNodes?: Array<Node<FlowVisualNodeData>>;
  initialEdges?: Edge[];
  onChange?: (snapshot: FlowCanvasSnapshot, nodes: Array<Node<FlowVisualNodeData>>, edges: Edge[]) => void;
  /** Dispara em qualquer alteração semântica aplicada ao markdown do fluxo. */
  onDirty?: () => void;
  theme?: "dark" | "light";
  toolbarPlacement?: "overlay" | "external";
  onExposeApi?: (api: FlowCanvasApi) => void;
};

function FlowCanvasInner({
  initialDefinition,
  initialNodes,
  initialEdges,
  onChange,
  onDirty,
  theme = "light",
  toolbarPlacement = "overlay",
  onExposeApi,
}: FlowCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstance = useRef<any>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const emitTimerRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string>("");
  const hasSemanticChangesRef = useRef(false);

  const seedNodes = useMemo(() => {
    const raw = initialNodes?.length ? initialNodes : buildInitialNodes(initialDefinition);
    const rawEdges = initialEdges?.length ? initialEdges : buildInitialEdges(initialDefinition);
    const entry = initialDefinition?.entry_step_id;
    const laid = computeAutoLayout(raw, rawEdges, entry);
    return applyOrphanFlags(laid, entry ?? laid[0]?.id ?? "", rawEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedEdges = useMemo(() => {
    return initialEdges?.length ? initialEdges : buildInitialEdges(initialDefinition);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [nodes, setNodes] = useState<Array<Node<FlowVisualNodeData>>>(seedNodes);
  const [edges, setEdges] = useState<Edge[]>(seedEdges);
  const [nodeCounter, setNodeCounter] = useState(seedNodes.length + 1);
  const [entryStepId, setEntryStepId] = useState(() => {
    const preferred = initialDefinition?.entry_step_id;
    if (preferred && seedNodes.some((node) => node.id === preferred)) return preferred;
    return seedNodes[0]?.id ?? "step_1";
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setNodes((cur) => {
      const next = applyOrphanFlags(cur, entryStepId, edges);
      const changed = next.some((node, index) => node.data.isOrphan !== cur[index]?.data.isOrphan);
      return changed ? next : cur;
    });
  }, [edges, entryStepId]);

  const initialFitDoneRef = useRef(false);

  const runViewportFit = useCallback(
    (animated = false) => {
      const instance = rfInstance.current;
      const host = canvasHostRef.current;
      if (!instance || !host || nodes.length === 0) return;
      const rect = host.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 80) return;
      setNodes((cur) => {
        const laid = computeAutoLayout(cur, edges, entryStepId);
        return applyOrphanFlags(laid, entryStepId, edges);
      });
      requestAnimationFrame(() => {
        const inst = rfInstance.current;
        if (!inst) return;
        void inst.fitView({
          padding: 0.14,
          duration: animated ? 280 : 0,
          minZoom: READABLE_MIN_ZOOM,
          maxZoom: 1.2,
          includeHiddenNodes: true,
        });
        const zoom = inst.getZoom?.() ?? 1;
        if (nodes.length <= 4 && zoom < 0.5) {
          inst.zoomTo?.(SMALL_FLOW_MIN_ZOOM, { duration: animated ? 220 : 0 });
        } else if (zoom < 0.22) {
          inst.zoomTo?.(0.32, { duration: 0 });
        }
      });
    },
    [edges, entryStepId, nodes.length]
  );

  const fitCanvas = useCallback(
    (animated = true) => {
      runViewportFit(animated);
    },
    [runViewportFit]
  );

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    initialFitDoneRef.current = false;

    const tryInitialFit = () => {
      if (initialFitDoneRef.current) return;
      const instance = rfInstance.current;
      const rect = host.getBoundingClientRect();
      if (!instance || nodes.length === 0 || rect.width < 40 || rect.height < 80) return;
      scheduleViewportFit(instance, host, 0, nodes.length);
      initialFitDoneRef.current = true;
    };

    const observer = new ResizeObserver(() => tryInitialFit());
    observer.observe(host);
    tryInitialFit();

    const timers = [80, 200, 450, 900].map((ms) => window.setTimeout(tryInitialFit, ms));
    return () => {
      observer.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [nodes.length, runViewportFit]);

  const focusEntryNode = useCallback(
    (animated = true) => {
      const instance = rfInstance.current;
      if (!instance || nodes.length === 0) return;
      const fallbackNode = nodes[0];
      const entryNode = nodes.find((node) => node.id === entryStepId) ?? fallbackNode;
      if (!entryNode) return;
      instance.setCenter(
        entryNode.position.x + NODE_W / 2,
        entryNode.position.y + estimateNodeHeight(entryNode) / 2,
        { zoom: ENTRY_FOCUS_ZOOM, duration: animated ? 280 : 0 }
      );
    },
    [entryStepId, nodes]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowVisualNodeData>>[]) => {
      const semanticChange = changes.some(
        (change) =>
          change.type !== "position" &&
          change.type !== "dimensions" &&
          change.type !== "select"
      );
      if (semanticChange) {
        hasSemanticChangesRef.current = true;
      }
      setNodes((cur) => applyNodeChanges(changes, cur));
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (changes.length > 0) {
        hasSemanticChangesRef.current = true;
      }
      setEdges((cur) => applyEdgeChanges(changes, cur));
    },
    []
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      hasSemanticChangesRef.current = true;
      setEdges((cur) => {
        const next = addEdge({
          ...connection,
          id: connectionId(connection),
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#7aa2f7", strokeWidth: 2 },
          type: "smoothstep",
        }, cur);
        return next;
      });
    },
    []
  );

  const handleAddNode = useCallback(
    (kind: FlowNodeKind) => {
      hasSemanticChangesRef.current = true;
      const id = `step_${nodeCounter}`;
      const newPosition = getNextVerticalPosition(nodes);
      const newNode: Node<FlowVisualNodeData> = {
        id, type: kind,
        position: newPosition,
        data: createDefaultNodeData(kind, nodeCounter),
      };
      setNodes((cur) => [...cur, newNode]);
      setNodeCounter((v) => v + 1);
      requestAnimationFrame(() => {
        const instance = rfInstance.current;
        if (!instance) return;
        instance.setCenter(
          newNode.position.x + NODE_W / 2,
          newNode.position.y + NODE_H_EST / 2,
          { zoom: Math.max(instance.getZoom?.() ?? ENTRY_FOCUS_ZOOM, 0.5), duration: 220 }
        );
      });
    },
    [nodeCounter, nodes]
  );

  const emitSnapshotNow = useCallback(
    (force = false): FlowCanvasSnapshot | null => {
      if (emitTimerRef.current) {
        window.clearTimeout(emitTimerRef.current);
        emitTimerRef.current = null;
      }
      if (!force && !hasSemanticChangesRef.current) return null;

      const resolvedEntry =
        entryStepId && nodes.some((node) => node.id === entryStepId)
          ? entryStepId
          : (nodes[0]?.id ?? "step_1");

      const definition = toDefinition(nodes, edges, resolvedEntry);
      const snapshotKey = JSON.stringify(definition);
      if (!force && snapshotKey === lastSnapshotRef.current) {
        hasSemanticChangesRef.current = false;
        return {
          definition,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        };
      }

      lastSnapshotRef.current = snapshotKey;
      hasSemanticChangesRef.current = false;

      const snapshot: FlowCanvasSnapshot = {
        definition,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      };

      onChange?.(snapshot, nodes, edges);
      onDirty?.();
      return snapshot;
    },
    [edges, entryStepId, nodes, onChange, onDirty]
  );

  useEffect(() => {
    onExposeApi?.({
      addNode: handleAddNode,
      fitCanvas: () => fitCanvas(true),
      flushAndSnapshot: () => emitSnapshotNow(true),
    });
  }, [emitSnapshotNow, fitCanvas, handleAddNode, onExposeApi]);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      hasSemanticChangesRef.current = true;
      setNodes((cur) => cur.filter((n) => n.id !== nodeId));
      setEdges((curEdges) => curEdges.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      requestAnimationFrame(() => fitCanvas());
    },
    [fitCanvas, selectedNodeId]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<FlowVisualNodeData>) => {
      hasSemanticChangesRef.current = true;
      setNodes((cur) => cur.map((n) => n.id !== nodeId ? n : { ...n, data: { ...n.data, ...updates } }));
    },
    []
  );

  const handleRemoveMenuOption = useCallback((nodeId: string, optionId: string) => {
    hasSemanticChangesRef.current = true;
    setNodes((cur) =>
      cur.map((node) => {
        if (node.id !== nodeId || node.data.kind !== "menu") return node;
        const current = node.data.menuOptions ?? [];
        if (current.length <= 1) return node;
        const menuOptions = current.filter((opt) => opt.id !== optionId);
        return {
          ...node,
          data: { ...node.data, menuOptions },
        };
      })
    );
    setEdges((cur) =>
      cur.filter((edge) => {
        if (edge.source !== nodeId) return true;
        const edgeOptId = extractOptionIdFromEdge(edge);
        return edgeOptId !== optionId;
      })
    );
  }, []);

  const handleSetEntryStepId = useCallback((stepId: string) => {
    if (!nodes.some((node) => node.id === stepId)) return;
    hasSemanticChangesRef.current = true;
    setEntryStepId(stepId);
  }, [nodes]);

  const handleRenameNodeId = useCallback(
    (oldId: string, nextIdRaw: string) => {
      const nextId = nextIdRaw.trim();
      if (!nextId || nextId === oldId) return;
      if (nodes.some((node) => node.id === nextId)) return;
      hasSemanticChangesRef.current = true;

      setNodes((cur) =>
        cur.map((node) =>
          node.id !== oldId
            ? node
            : {
                ...node,
                id: nextId,
                data: {
                  ...node.data,
                  stepId: nextId,
                  field:
                    node.data.kind === "input"
                      ? String(node.data.field ?? `${oldId}_value`).replace(oldId, nextId)
                      : node.data.kind === "menu"
                        ? String(node.data.field ?? oldId).replace(oldId, nextId)
                        : node.data.field,
                },
              }
        )
      );

      setEdges((cur) =>
        cur.map((edge) => {
          const source = edge.source === oldId ? nextId : edge.source;
          const target = edge.target === oldId ? nextId : edge.target;
          let edgeId = edge.id;
          if (edge.id.startsWith(`${oldId}__`)) {
            edgeId = edge.id.replace(`${oldId}__`, `${nextId}__`);
          }
          if (edge.id.includes(`__${oldId}__`)) {
            edgeId = edgeId.replace(`__${oldId}__`, `__${nextId}__`);
          }
          if (edge.id.endsWith(`__${oldId}`)) {
            edgeId = edgeId.slice(0, -oldId.length) + nextId;
          }
          return { ...edge, id: edgeId, source, target };
        })
      );

      if (entryStepId === oldId) setEntryStepId(nextId);
      if (selectedNodeId === oldId) setSelectedNodeId(nextId);
    },
    [entryStepId, nodes, selectedNodeId]
  );

  const callbacks = useMemo(
    () => ({
      onUpdate: handleUpdateNode,
      onDelete: handleDeleteNode,
      onRemoveMenuOption: handleRemoveMenuOption,
    }),
    [handleUpdateNode, handleDeleteNode, handleRemoveMenuOption]
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    if (!onChange) return;
    if (!hasSemanticChangesRef.current) return;
    onDirty?.();
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current);
    }
    emitTimerRef.current = window.setTimeout(() => {
      emitSnapshotNow(false);
    }, 80);

    return () => {
      if (emitTimerRef.current) {
        window.clearTimeout(emitTimerRef.current);
      }
    };
  }, [edges, entryStepId, nodes, onChange, onDirty, emitSnapshotNow]);

  const isDark = theme === "dark";
  const surfaceStyles = useMemo(
    () => ({
      canvasStyle: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        border: isDark ? "1px solid rgba(63, 152, 72, 0.42)" : "1px solid #dcebd8",
        borderRadius: 14,
        overflow: "hidden",
        background: isDark ? "#0b1f10" : "#f4faf2",
        boxShadow: isDark ? "0 6px 24px rgba(0, 0, 0, 0.45)" : "0 4px 18px rgba(11, 34, 16, 0.06)",
      } satisfies CSSProperties,
      flowBackground: isDark
        ? "linear-gradient(180deg, #0b1f10 0%, #060d08 100%)"
        : "linear-gradient(180deg, #f4faf2 0%, #eef7eb 100%)",
      dotColor: isDark ? "#1f3d24" : "#c8dcc4",
      miniMapStyle: {
        background: isDark ? "#0d2214" : "#ffffff",
        border: isDark ? "1px solid rgba(63, 152, 72, 0.42)" : "1px solid #dcebd8",
        borderRadius: 10,
        width: 190,
        height: 120,
        boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.45)" : "0 4px 14px rgba(11, 34, 16, 0.08)",
      } satisfies CSSProperties,
      controlsStyle: {
        border: isDark ? "1px solid rgba(63, 152, 72, 0.42)" : "1px solid #dcebd8",
        borderRadius: 10,
        background: isDark ? "#0d2214" : "#ffffff",
        boxShadow: isDark ? "0 4px 14px rgba(0, 0, 0, 0.45)" : "0 4px 14px rgba(11, 34, 16, 0.08)",
      } satisfies CSSProperties,
      maskColor: isDark ? "#1a3d2266" : "#e8f5e966",
    }),
    [isDark]
  );

  return (
    <FlowNodeCallbacksContext.Provider value={callbacks}>
      <div style={wrapStyle}>
        <div ref={canvasHostRef} style={canvasShellStyle}>
          {toolbarPlacement === "overlay" ? (
            <div style={canvasToolbarStyle}>
              <button type="button" style={toolbarButtonStyle} onClick={() => handleAddNode("message")}>
                <MessageSquare size={13} strokeWidth={2.2} />
                Mensagem
              </button>
              <button type="button" style={toolbarButtonStyle} onClick={() => handleAddNode("input")}>
                <PencilLine size={13} strokeWidth={2.2} />
                Entrada
              </button>
              <button type="button" style={toolbarButtonStyle} onClick={() => handleAddNode("menu")}>
                <List size={13} strokeWidth={2.2} />
                Menu
              </button>
              <button type="button" style={toolbarButtonStyle} onClick={() => handleAddNode("complete")}>
                <CheckCircle2 size={13} strokeWidth={2.2} />
                Fim
              </button>
              <button type="button" style={toolbarButtonStyle} onClick={() => fitCanvas()}>
                <LocateFixed size={13} strokeWidth={2.2} />
                Centralizar
              </button>
            </div>
          ) : null}
          <div style={{ ...surfaceStyles.canvasStyle, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
              }}
              onPaneClick={() => {
                setSelectedNodeId(null);
              }}
              onInit={(instance) => {
                rfInstance.current = instance;
                scheduleViewportFit(instance, canvasHostRef.current, 0, nodes.length);
                window.setTimeout(() => runViewportFit(false), 180);
                window.setTimeout(() => runViewportFit(false), 520);
              }}
              nodeOrigin={[0, 0]}
              onlyRenderVisibleElements={false}
              minZoom={READABLE_MIN_ZOOM}
              maxZoom={1.6}
              snapToGrid
              snapGrid={[16, 16]}
              style={{
                background: surfaceStyles.flowBackground,
                width: "100%",
                height: "100%",
                flex: 1,
                minHeight: 0,
              }}
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: "#3f9848", strokeWidth: 2 },
                type: "smoothstep",
              }}
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
            >
              <Background color={surfaceStyles.dotColor} gap={26} size={1.2} variant={"dots" as never} />
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                nodeColor={(node) => {
                  const colors: Record<string, string> = {
                    message: "#3f9848",
                    input: "#d4a017",
                    menu: "#5c9c63",
                    complete: "#2d7a36",
                    transfer: "#4f46e5",
                  };
                  return colors[(node.data as FlowVisualNodeData).kind] ?? "#9cb89f";
                }}
                style={surfaceStyles.miniMapStyle}
                maskColor={surfaceStyles.maskColor}
              />
              <Controls showInteractive={false} position="bottom-left" style={surfaceStyles.controlsStyle} />
            </ReactFlow>
            {selectedNode && (
              <FlowNodeEditorSideover
                selectedNode={selectedNode}
                allNodeIds={nodes.map((node) => node.id)}
                entryStepId={entryStepId}
                onSetEntryStepId={handleSetEntryStepId}
                onRenameNodeId={handleRenameNodeId}
                onUpdateNode={handleUpdateNode}
                onRemoveMenuOption={handleRemoveMenuOption}
                onDeleteNode={handleDeleteNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
          </div>
        </div>
      </div>
    </FlowNodeCallbacksContext.Provider>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  height: "100%",
  position: "relative",
};

const canvasShellStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

const canvasToolbarStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 6,
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  maxWidth: "calc(100% - 24px)",
  background: "rgba(11, 31, 16, 0.92)",
  border: "1px solid rgba(146, 255, 0, 0.2)",
  borderRadius: 11,
  padding: 7,
  boxShadow: "0 8px 20px rgba(6, 13, 8, 0.55)",
  backdropFilter: "blur(4px)",
};

const toolbarButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(146, 255, 0, 0.1)",
  color: "#e8f5e9",
  border: "1px solid rgba(63, 152, 72, 0.45)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.1,
  cursor: "pointer",
};
