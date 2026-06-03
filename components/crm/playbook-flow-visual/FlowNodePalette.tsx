"use client";

import type { CSSProperties } from "react";
import { CheckCircle, ClipboardList, MessageSquare, Pencil } from "lucide-react";
import type { FlowNodeKind } from "./types";

type FlowNodePaletteProps = {
  onAddNode: (kind: FlowNodeKind) => void;
};

const NODE_OPTIONS: Array<{
  kind: FlowNodeKind;
  label: string;
  description: string;
  color: string;
  Icon: React.ComponentType<{ size: number; strokeWidth: number }>;
}> = [
  {
    kind: "message",
    label: "Mensagem",
    description: "Envia texto fixo ao lead.",
    color: "#388bfd",
    Icon: MessageSquare,
  },
  {
    kind: "input",
    label: "Coleta",
    description: "Captura resposta do lead.",
    color: "#e08a14",
    Icon: Pencil,
  },
  {
    kind: "menu",
    label: "Menu",
    description: "Exibe opções de escolha.",
    color: "#9254de",
    Icon: ClipboardList,
  },
  {
    kind: "complete",
    label: "Conclusão",
    description: "Finaliza e encaminha.",
    color: "#2ea043",
    Icon: CheckCircle,
  },
];

export function FlowNodePalette({ onAddNode }: FlowNodePaletteProps) {
  return (
    <aside style={panelStyle}>
      <p style={titleStyle}>Adicionar nó</p>
      <div style={gridStyle}>
        {NODE_OPTIONS.map((opt) => {
          const { Icon } = opt;
          return (
            <button
              key={opt.kind}
              type="button"
              onClick={() => onAddNode(opt.kind)}
              style={btnStyle(opt.color)}
              title={opt.description}
            >
              <Icon size={16} strokeWidth={2} />
              <span style={btnLabel}>{opt.label}</span>
              <span style={btnDesc}>{opt.description}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  border: "1px solid #2b3544",
  borderRadius: 12,
  background: "linear-gradient(180deg, #121926 0%, #0d1117 55%)",
  padding: "12px 14px",
};

const titleStyle: CSSProperties = {
  margin: "0 0 2px",
  color: "#e6edf3",
  fontSize: 12.5,
  fontWeight: 700,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

function btnStyle(color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    border: `1px solid ${color}44`,
    borderRadius: 10,
    background: `${color}14`,
    color: "#e6edf3",
    textAlign: "left",
    cursor: "pointer",
    padding: "10px 10px 9px",
    minHeight: 78,
  };
}

const btnLabel: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  lineHeight: 1.2,
};

const btnDesc: CSSProperties = {
  fontSize: 10.5,
  color: "#8b949e",
  lineHeight: 1.3,
};
