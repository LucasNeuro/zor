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
  PlaybookFlowDefinition,
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowMenuOption,
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
  attempt = 0
) {
  const rect = host?.getBoundingClientRect();
  if (!rect || rect.width < 40 || rect.height < 80) {
    if (attempt < 24) {
      requestAnimationFrame(() => scheduleViewportFit(instance, host, attempt + 1));
    }
    return;
  }
  void instance.fitView({
    padding: 0.2,
    duration: attempt > 0 ? 200 : 0,
    minZoom: READABLE_MIN_ZOOM,
    maxZoom: 1.15,
  });
  const zoom = instance.getZoom?.() ?? 1;
  if (zoom < READABLE_MIN_ZOOM) {
    instance.zoomTo?.(READABLE_MIN_ZOOM, { duration: 0 });
  }
}
const CANVAS_MIN_H = 520;
const CANVAS_MAX_H = 860;

// ─── Auto-layout (BFS topological) ───────────────────────────────────────────

const NODE_W = 300;
const NODE_H_EST = 230;
const H_GAP = 132;
const V_GAP = 92;
const READABLE_MIN_ZOOM = 0.3;
const ENTRY_FOCUS_ZOOM = 0.42;
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
  const layerWidth = Math.max(0, layerSize - 1) * (NODE_W + H_GAP);
  const startX = -layerWidth / 2;
  return {
    x: startX + index * (NODE_W + H_GAP),
    y: layerY,
  };
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
  return def.steps.map((step) => ({
    id: step.id,
    type: step.kind,                // ← must match nodeTypes key
    position: { x: 0, y: 0 },      // overwritten by computeAutoLayout
    data: toVisualNodeData(step),
  }));
}

function buildInitialEdges(def?: PlaybookFlowDefinition): Edge[] {
  if (!def?.steps?.length) return [];
  const edges: Edge[] = [];

  for (const step of def.steps) {
    if ((step.kind === "message" || step.kind === "input") && step.next) {
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
      for (const opt of step.options) {
        if (!opt.next) continue;
        edges.push({
          id: `${step.id}__${opt.next}__${opt.id}`,
          source: step.id,
          target: opt.next,
          label: opt.label,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#a78bfa", strokeWidth: 2 },
          labelStyle: { fill: "#e2e8f0", fontSize: 10, fontFamily: "inherit", fontWeight: 600 },
          labelBgStyle: { fill: "#0f172acc", opacity: 0.96 },
          labelBgPadding: [4, 4],
          labelBgBorderRadius: 4,
          type: "smoothstep",
        });
      }
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
          journey: (node.data.journey as PlaybookFlowJourney | undefined) ?? undefined,
          message: node.data.content,
          next: firstTarget,
        };
      }
      if (node.data.kind === "input") {
        return {
          id: node.id, kind: "input", title,
          journey: (node.data.journey as PlaybookFlowJourney | undefined) ?? undefined,
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
          journey: (node.data.journey as PlaybookFlowJourney | undefined) ?? undefined,
          prompt: node.data.content,
          field: String(node.data.field ?? node.id).trim() || node.id,
          options,
        };
      }
      return {
        id: node.id,
        kind: "complete",
        title,
        journey: (node.data.journey as PlaybookFlowJourney | undefined) ?? undefined,
        complete: { type: "complete", summary: node.data.content },
      };
    }),
  };
}

function connectionId(c: Connection): string {
  return `${c.source ?? "src"}__${c.target ?? "tgt"}__${Date.now()}`;
}

// ─── FlowCanvasInner ──────────────────────────────────────────────────────────

type FlowCanvasProps = {
  initialDefinition?: PlaybookFlowDefinition;
  initialNodes?: Array<Node<FlowVisualNodeData>>;
  initialEdges?: Edge[];
  onChange?: (snapshot: FlowCanvasSnapshot, nodes: Array<Node<FlowVisualNodeData>>, edges: Edge[]) => void;
  /** Dispara em qualquer alteração semântica aplicada ao markdown do fluxo. */
  onDirty?: () => void;
};

function FlowCanvasInner({ initialDefinition, initialNodes, initialEdges, onChange, onDirty }: FlowCanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstance = useRef<any>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const emitTimerRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string>("");
  const hasSemanticChangesRef = useRef(false);

  const seedNodes = useMemo(() => {
    const raw = initialNodes?.length ? initialNodes : buildInitialNodes(initialDefinition);
    const rawEdges = initialEdges?.length ? initialEdges : buildInitialEdges(initialDefinition);
    return computeAutoLayout(raw, rawEdges, initialDefinition?.entry_step_id);
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

  const fitCanvas = useCallback((animated = true) => {
    const instance = rfInstance.current;
    if (!instance) return;
    instance.fitView({
      padding: 0.18,
      duration: animated ? 280 : 0,
      minZoom: READABLE_MIN_ZOOM,
      maxZoom: 1.15,
    });
    const zoom = instance.getZoom?.() ?? 1;
    if (zoom < READABLE_MIN_ZOOM) {
      instance.zoomTo(READABLE_MIN_ZOOM, { duration: 220 });
    }
  }, []);

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

  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const tryInitialFit = () => {
      if (initialFitDoneRef.current) return;
      const instance = rfInstance.current;
      const rect = host.getBoundingClientRect();
      if (!instance || nodes.length === 0 || rect.width < 40 || rect.height < 80) return;
      scheduleViewportFit(instance, host);
      initialFitDoneRef.current = true;
    };

    const observer = new ResizeObserver(() => tryInitialFit());
    observer.observe(host);
    tryInitialFit();
    return () => observer.disconnect();
  }, [nodes.length]);


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
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current);
    }
    emitTimerRef.current = window.setTimeout(() => {
      const resolvedEntry =
        entryStepId && nodes.some((node) => node.id === entryStepId)
          ? entryStepId
          : (nodes[0]?.id ?? "step_1");

      if (resolvedEntry !== entryStepId) {
        setEntryStepId(resolvedEntry);
      }

      const definition = toDefinition(nodes, edges, resolvedEntry);
      const snapshotKey = JSON.stringify(definition);
      if (snapshotKey === lastSnapshotRef.current) return;
      lastSnapshotRef.current = snapshotKey;
      hasSemanticChangesRef.current = false;

      onChange(
        {
          definition,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
        nodes,
        edges
      );
      onDirty?.();
    }, 80);

    return () => {
      if (emitTimerRef.current) {
        window.clearTimeout(emitTimerRef.current);
      }
    };
  }, [edges, entryStepId, nodes, onChange, onDirty]);

  return (
    <FlowNodeCallbacksContext.Provider value={callbacks}>
      <div style={wrapStyle}>
        <div ref={canvasHostRef} style={canvasShellStyle}>
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
          <div style={canvasStyle}>
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
                scheduleViewportFit(instance, canvasHostRef.current);
              }}
              nodeOrigin={[0, 0]}
              onlyRenderVisibleElements={false}
              minZoom={READABLE_MIN_ZOOM}
              maxZoom={1.6}
              snapToGrid
              snapGrid={[16, 16]}
              style={{
                background: "linear-gradient(180deg, #060d08 0%, #0b1f10 100%)",
                width: "100%",
                height: "100%",
              }}
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: "#7aa2f7", strokeWidth: 2 },
                type: "smoothstep",
              }}
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#3f9848" gap={26} size={1.2} variant={"dots" as never} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => {
                  const colors: Record<string, string> = {
                    message: "#92ff00",
                    input: "#d4a017",
                    menu: "#3f9848",
                    complete: "#92ff00",
                  };
                  return colors[(node.data as FlowVisualNodeData).kind] ?? "#5d7a67";
                }}
                style={{
                  background: "#0b1f10",
                  border: "1px solid rgba(146, 255, 0, 0.2)",
                  borderRadius: 10,
                  width: 190,
                  height: 120,
                  boxShadow: "0 8px 22px #02061799",
                }}
                maskColor="#1f2a3b66"
              />
              <Controls
                showInteractive={false}
                style={{
                  border: "1px solid #22314a",
                  borderRadius: 10,
                  background: "#0c1423",
                  boxShadow: "0 8px 22px #02061799",
                }}
              />
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
};

const canvasShellStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: `clamp(${CANVAS_MIN_H}px, 76vh, ${CANVAS_MAX_H}px)`,
  minHeight: `${CANVAS_MIN_H}px`,
  maxHeight: `${CANVAS_MAX_H}px`,
};

const canvasStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: "1px solid rgba(146, 255, 0, 0.18)",
  borderRadius: 14,
  overflow: "hidden",
  background: "#060d08",
  boxShadow: "0 14px 36px rgba(6, 13, 8, 0.65)",
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
