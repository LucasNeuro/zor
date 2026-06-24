"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { formatarGatilhoConfig } from "@/lib/hub/followup-types";
import {
  FOLLOWUP_NODE_TYPES,
  FollowupNodeCallbacksContext,
  FollowupNodeThemeContext,
} from "./FollowupFlowNodes";
import { FollowupStepEditorSideover } from "./FollowupStepEditorSideover";
import { FollowupTriggerEditorSideover } from "./FollowupTriggerEditorSideover";
import {
  configToStartNodeData,
  FOLLOWUP_START_NODE_ID,
  passoToNodeData,
  type FollowupFlowNodeData,
} from "./types";

export type FollowupFlowCanvasApi = {
  fitCanvas: () => void;
  flushPendingEdit: () => Promise<void>;
  openTriggerEditor: () => void;
};

const NODE_TYPES = FOLLOWUP_NODE_TYPES;
const NODE_H = 180;
const V_GAP = 96;

type Props = {
  config: HubAgenteFollowupConfig;
  passos: HubAgenteFollowupPasso[];
  saving: boolean;
  uploadingId: string | null;
  disabled?: boolean;
  theme?: "light" | "dark";
  fullHeight?: boolean;
  onExposeApi?: (api: FollowupFlowCanvasApi) => void;
  onSalvarConfig: (patch: Partial<HubAgenteFollowupConfig>) => Promise<void>;
  onAtualizarConfigLocal: (patch: Partial<HubAgenteFollowupConfig>) => void;
  onSalvarPasso: (passo: HubAgenteFollowupPasso) => Promise<void>;
  onExcluirPasso: (id: string) => Promise<void>;
  onReorder: (reordered: HubAgenteFollowupPasso[]) => Promise<void>;
  onUploadImagem: (passoId: string, file: File) => Promise<void>;
  onAtualizarLocal: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
};

function buildGraph(
  passos: HubAgenteFollowupPasso[],
  config: HubAgenteFollowupConfig
): {
  nodes: Array<Node<FollowupFlowNodeData>>;
  edges: Edge[];
} {
  const sorted = [...passos].sort((a, b) => a.ordem - b.ordem);
  const nodes: Array<Node<FollowupFlowNodeData>> = [
    {
      id: FOLLOWUP_START_NODE_ID,
      type: "followupStart",
      position: { x: 0, y: 0 },
      data: configToStartNodeData(config),
      draggable: false,
      selectable: true,
    },
  ];
  const edges: Edge[] = [];
  const gatilhoLabel = formatarGatilhoConfig(config);

  sorted.forEach((passo, index) => {
    const y = (index + 1) * (NODE_H + V_GAP);
    nodes.push({
      id: passo.id,
      type: "followupPasso",
      position: { x: 0, y },
      data: passoToNodeData(passo),
      draggable: false,
    });

    const source = index === 0 ? FOLLOWUP_START_NODE_ID : sorted[index - 1]!.id;
    const active = passo.ativo;
    const edgeLabel = index === 0 ? gatilhoLabel : `+${passoToNodeData(passo).atrasoLabel}`;
    edges.push({
      id: `e-${source}-${passo.id}`,
      source,
      target: passo.id,
      type: "smoothstep",
      animated: active,
      label: edgeLabel,
      labelStyle: { fill: "#2e7d32", fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7a67", width: 16, height: 16 },
      style: { stroke: active ? "#3f9848" : "#b8d4bc", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}

function FollowupFlowCanvasInner({
  config,
  passos,
  saving,
  uploadingId,
  disabled,
  theme = "light",
  fullHeight,
  onExposeApi,
  onSalvarConfig,
  onAtualizarConfigLocal,
  onSalvarPasso,
  onExcluirPasso,
  onReorder,
  onUploadImagem,
  onAtualizarLocal,
}: Props) {
  const isLight = theme === "light";
  const rf = useReactFlow();
  const passosOrdenados = useMemo(
    () => [...passos].sort((a, b) => a.ordem - b.ordem),
    [passos]
  );
  const graph = useMemo(() => buildGraph(passosOrdenados, config), [passosOrdenados, config]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const fitOnce = useRef(false);
  const flushPendingRef = useRef<(() => Promise<void>) | null>(null);

  const fitCanvas = useCallback(() => {
    void rf.fitView({ padding: 0.18, duration: 200 });
  }, [rf]);

  const flushPendingEdit = useCallback(async () => {
    if (flushPendingRef.current) {
      await flushPendingRef.current();
    }
  }, []);

  const openTriggerEditor = useCallback(() => {
    setSelectedId(null);
    setTriggerOpen(true);
  }, []);

  useEffect(() => {
    onExposeApi?.({ fitCanvas, flushPendingEdit, openTriggerEditor });
  }, [onExposeApi, fitCanvas, flushPendingEdit, openTriggerEditor]);

  const selectedPasso = useMemo(
    () => passosOrdenados.find((p) => p.id === selectedId) ?? null,
    [passosOrdenados, selectedId]
  );

  const selectedIndex = selectedPasso
    ? passosOrdenados.findIndex((p) => p.id === selectedPasso.id)
    : -1;

  useEffect(() => {
    if (selectedId && !passosOrdenados.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [passosOrdenados, selectedId]);

  const onSelect = useCallback((passoId: string) => {
    setTriggerOpen(false);
    setSelectedId(passoId);
  }, []);

  const onSelectStart = useCallback(() => {
    setSelectedId(null);
    setTriggerOpen(true);
  }, []);

  function movePasso(direction: -1 | 1) {
    if (!selectedPasso || selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= passosOrdenados.length) return;
    const sorted = [...passosOrdenados];
    const [moved] = sorted.splice(selectedIndex, 1);
    sorted.splice(target, 0, moved);
    const reordered = sorted.map((p, i) => ({ ...p, ordem: i + 1 }));
    void onReorder(reordered);
  }

  return (
    <FollowupNodeThemeContext.Provider value={theme}>
      <FollowupNodeCallbacksContext.Provider value={{ onSelect, onSelectStart }}>
        <div
          style={{
            position: "relative",
            height: fullHeight ? "100%" : 520,
            minHeight: fullHeight ? 0 : 520,
            flex: fullHeight ? 1 : undefined,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={NODE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={!disabled}
            fitView
            fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 1.15 }}
            minZoom={0.2}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
            onInit={(instance) => {
              if (!fitOnce.current) {
                fitOnce.current = true;
                requestAnimationFrame(() => {
                  void instance.fitView({ padding: 0.18, duration: 0 });
                });
              }
            }}
            onNodeClick={(_, node) => {
              if (node.id === FOLLOWUP_START_NODE_ID) {
                onSelectStart();
                return;
              }
              onSelect(node.id);
            }}
            onPaneClick={() => {
              setSelectedId(null);
              setTriggerOpen(false);
            }}
            style={{ background: isLight ? "#f4faf2" : "rgba(4,10,6,0.55)" }}
          >
            <Background color={isLight ? "#dcebd8" : "#1f3d28"} gap={18} size={1} />
            <Controls
              showInteractive={false}
              style={{
                background: isLight ? "#ffffff" : "rgba(6,13,8,0.9)",
                border: isLight ? "1px solid #dcebd8" : "1px solid #2d4a35",
              }}
            />
            <MiniMap
              nodeColor={(n) => {
                const kind = (n.data as FollowupFlowNodeData).kind;
                if (kind === "start") return "#3fb950";
                if (kind === "imagem") return "#58a6ff";
                if (kind === "texto_imagem") return "#c9a24a";
                return "#92ff00";
              }}
              maskColor={isLight ? "rgba(244,250,242,0.75)" : "rgba(4,10,6,0.72)"}
              style={{
                background: isLight ? "#ffffff" : "rgba(6,13,8,0.88)",
                border: isLight ? "1px solid #dcebd8" : "1px solid #2d4a35",
              }}
            />
          </ReactFlow>

          {triggerOpen && config ? (
            <FollowupTriggerEditorSideover
              config={config}
              saving={saving}
              onClose={() => setTriggerOpen(false)}
              onSave={async (patch) => {
                await onSalvarConfig(patch);
              }}
              onPatch={(patch) => onAtualizarConfigLocal(patch)}
              onRegisterFlush={(flush) => {
                flushPendingRef.current = flush;
              }}
            />
          ) : null}

          {selectedPasso ? (
            <FollowupStepEditorSideover
              theme={theme}
              passo={selectedPasso}
              saving={saving}
              uploading={uploadingId === selectedPasso.id}
              canMoveUp={selectedIndex > 0}
              canMoveDown={selectedIndex >= 0 && selectedIndex < passosOrdenados.length - 1}
              onClose={() => setSelectedId(null)}
              onSave={(p) => onSalvarPasso(p)}
              onDelete={(id) => {
                setSelectedId(null);
                void onExcluirPasso(id);
              }}
              onMoveUp={() => movePasso(-1)}
              onMoveDown={() => movePasso(1)}
              onPatch={(patch) => onAtualizarLocal(selectedPasso.id, patch)}
              onUploadImagem={(file) => void onUploadImagem(selectedPasso.id, file)}
              onRegisterFlush={(flush) => {
                flushPendingRef.current = flush;
              }}
            />
          ) : null}
        </div>
      </FollowupNodeCallbacksContext.Provider>
    </FollowupNodeThemeContext.Provider>
  );
}

export function FollowupFlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FollowupFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
