"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import { FOLLOWUP_NODE_TYPES, FollowupNodeCallbacksContext } from "./FollowupFlowNodes";
import { FollowupStepEditorSideover } from "./FollowupStepEditorSideover";
import {
  FOLLOWUP_START_NODE_ID,
  passoToNodeData,
  type FollowupFlowNodeData,
} from "./types";

const NODE_TYPES = FOLLOWUP_NODE_TYPES;
const NODE_W = 280;
const NODE_H = 168;
const V_GAP = 88;

type Props = {
  passos: HubAgenteFollowupPasso[];
  saving: boolean;
  uploadingId: string | null;
  disabled?: boolean;
  onSalvarPasso: (passo: HubAgenteFollowupPasso) => Promise<void>;
  onExcluirPasso: (id: string) => Promise<void>;
  onReorder: (reordered: HubAgenteFollowupPasso[]) => Promise<void>;
  onUploadImagem: (passoId: string, file: File) => Promise<void>;
  onAtualizarLocal: (id: string, patch: Partial<HubAgenteFollowupPasso>) => void;
};

function buildGraph(passos: HubAgenteFollowupPasso[]): {
  nodes: Array<Node<FollowupFlowNodeData>>;
  edges: Edge[];
} {
  const sorted = [...passos].sort((a, b) => a.ordem - b.ordem);
  const nodes: Array<Node<FollowupFlowNodeData>> = [
    {
      id: FOLLOWUP_START_NODE_ID,
      type: "followupStart",
      position: { x: 0, y: 0 },
      data: { kind: "start" },
      draggable: false,
      selectable: false,
    },
  ];
  const edges: Edge[] = [];

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
    edges.push({
      id: `e-${source}-${passo.id}`,
      source,
      target: passo.id,
      type: "smoothstep",
      animated: passo.ativo,
      label: `+${passoToNodeData(passo).atrasoLabel}`,
      labelStyle: { fill: "#92ff00", fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: "rgba(6,13,8,0.88)", fillOpacity: 0.92 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#5d7a67", width: 16, height: 16 },
      style: { stroke: passo.ativo ? "#3fb950" : "#484f58", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}

function FollowupFlowCanvasInner({
  passos,
  saving,
  uploadingId,
  disabled,
  onSalvarPasso,
  onExcluirPasso,
  onReorder,
  onUploadImagem,
  onAtualizarLocal,
}: Props) {
  const passosOrdenados = useMemo(
    () => [...passos].sort((a, b) => a.ordem - b.ordem),
    [passos]
  );
  const graph = useMemo(() => buildGraph(passosOrdenados), [passosOrdenados]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fitOnce = useRef(false);

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
    setSelectedId(passoId);
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
    <FollowupNodeCallbacksContext.Provider value={{ onSelect }}>
      <div style={{ position: "relative", height: 520, borderRadius: 12, overflow: "hidden" }}>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!disabled}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.45, maxZoom: 1.1 }}
          minZoom={0.25}
          maxZoom={1.4}
          proOptions={{ hideAttribution: true }}
          onInit={(instance) => {
            if (!fitOnce.current) {
              fitOnce.current = true;
              requestAnimationFrame(() => {
                void instance.fitView({ padding: 0.22, duration: 0 });
              });
            }
          }}
          onNodeClick={(_, node) => {
            if (node.id !== FOLLOWUP_START_NODE_ID) setSelectedId(node.id);
          }}
          onPaneClick={() => setSelectedId(null)}
          style={{ background: "rgba(4,10,6,0.55)" }}
        >
          <Background color="#1f3d28" gap={18} size={1} />
          <Controls showInteractive={false} style={{ background: "rgba(6,13,8,0.9)", border: "1px solid #2d4a35" }} />
          <MiniMap
            nodeColor={(n) => {
              const kind = (n.data as FollowupFlowNodeData).kind;
              if (kind === "start") return "#3fb950";
              if (kind === "imagem") return "#58a6ff";
              if (kind === "texto_imagem") return "#c9a24a";
              return "#92ff00";
            }}
            maskColor="rgba(4,10,6,0.72)"
            style={{ background: "rgba(6,13,8,0.88)", border: "1px solid #2d4a35" }}
          />
        </ReactFlow>

        {selectedPasso ? (
          <FollowupStepEditorSideover
            passo={selectedPasso}
            saving={saving}
            uploading={uploadingId === selectedPasso.id}
            canMoveUp={selectedIndex > 0}
            canMoveDown={selectedIndex >= 0 && selectedIndex < passosOrdenados.length - 1}
            onClose={() => setSelectedId(null)}
            onSave={(p) => void onSalvarPasso(p)}
            onDelete={(id) => {
              setSelectedId(null);
              void onExcluirPasso(id);
            }}
            onMoveUp={() => movePasso(-1)}
            onMoveDown={() => movePasso(1)}
            onPatch={(patch) => onAtualizarLocal(selectedPasso.id, patch)}
            onUploadImagem={(file) => void onUploadImagem(selectedPasso.id, file)}
          />
        ) : null}
      </div>
    </FollowupNodeCallbacksContext.Provider>
  );
}

export function FollowupFlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FollowupFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
