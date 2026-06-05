"use client";

import type { CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import { CheckCircle, ClipboardList, MessageSquare, Pencil, Trash2, Plus } from "lucide-react";
import type { FlowMenuOption, FlowVisualNodeData } from "./types";

type FlowNodeInspectorProps = {
  selectedNode: Node<FlowVisualNodeData> | null;
  onUpdateNode: (nodeId: string, updates: Partial<FlowVisualNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
};

const KIND_COLOR: Record<string, string> = {
  message: "#388bfd",
  input: "#e08a14",
  menu: "#9254de",
  complete: "#2ea043",
};

const KIND_LABEL: Record<string, string> = {
  message: "Mensagem",
  input: "Coleta",
  menu: "Menu",
  complete: "Conclusão",
};

const KIND_ICON: Record<string, React.ComponentType<{ size: number; strokeWidth: number }>> = {
  message: MessageSquare,
  input: Pencil,
  menu: ClipboardList,
  complete: CheckCircle,
};

export function FlowNodeInspector({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
}: FlowNodeInspectorProps) {
  if (!selectedNode) {
    return (
      <aside style={panelStyle}>
        <p style={panelTitleStyle}>Inspector</p>
        <p style={emptyStyle}>Clique num nó para inspecionar e editar.</p>
      </aside>
    );
  }

  const { id, data } = selectedNode;
  const accent = KIND_COLOR[data.kind] ?? "#484f58";
  const kindLabel = KIND_LABEL[data.kind] ?? data.kind;
  const KindIcon = KIND_ICON[data.kind] ?? MessageSquare;

  function update(updates: Partial<FlowVisualNodeData>) {
    onUpdateNode(id, updates);
  }

  function updateOptionLabel(optionId: string, label: string) {
    const options = (data.menuOptions ?? []).map((o) =>
      o.id === optionId ? { ...o, label } : o
    );
    update({ menuOptions: options });
  }

  function removeOption(optionId: string) {
    update({ menuOptions: (data.menuOptions ?? []).filter((o) => o.id !== optionId) });
  }

  function addOption() {
    const existing = data.menuOptions ?? [];
    const newOpt: FlowMenuOption = {
      id: `opcao_${existing.length + 1}_${Date.now()}`,
      label: `Opção ${existing.length + 1}`,
    };
    update({ menuOptions: [...existing, newOpt] });
  }

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{ color: accent, display: "flex", alignItems: "center" }}>
          <KindIcon size={13} strokeWidth={2.2} />
        </span>
        <p style={{ ...panelTitleStyle, margin: 0 }}>Inspector</p>
        <span style={{ ...kindChipStyle, borderColor: accent, color: accent }}>{kindLabel}</span>
      </div>

      <div style={fieldsStyle}>
        {/* ID */}
        <FieldRow label="ID do passo">
          <code style={idCodeStyle}>{id}</code>
        </FieldRow>

        {/* Title */}
        <FieldRow label="Título">
          <input
            value={data.title ?? ""}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Título do passo…"
            style={inputStyle}
          />
        </FieldRow>

        {/* Content */}
        <FieldRow label={data.kind === "menu" ? "Prompt do menu" : data.kind === "input" ? "Prompt da coleta" : data.kind === "complete" ? "Mensagem de conclusão" : "Mensagem"}>
          <textarea
            value={data.content}
            onChange={(e) => update({ content: e.target.value })}
            rows={5}
            style={textareaStyle}
          />
        </FieldRow>

        {/* Menu options */}
        {data.kind === "menu" && (
          <FieldRow label={`Opções (${(data.menuOptions ?? []).length})`}>
            <div style={optionsWrapStyle}>
              {(data.menuOptions ?? []).map((opt, idx) => (
                <div key={opt.id} style={optionRowStyle}>
                  <span style={{ ...optionNumStyle, color: accent }}>{idx + 1}</span>
                  <input
                    value={opt.label}
                    onChange={(e) => updateOptionLabel(opt.id, e.target.value)}
                    style={optionInputStyle}
                    placeholder={`Opção ${idx + 1}…`}
                  />
              <button
                type="button"
                onClick={() => removeOption(opt.id)}
                style={optionRemoveStyle}
                title="Remover opção"
              >
                <Trash2 size={10} strokeWidth={2} />
              </button>
                </div>
              ))}
              <button type="button" onClick={addOption} style={addOptBtnStyle}>
                <Plus size={10} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                Adicionar opção
              </button>
            </div>
          </FieldRow>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDeleteNode(id)}
          style={deleteBtnStyle}
        >
          <Trash2 size={11} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          Remover nó
        </button>
      </div>
    </aside>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldRowStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  border: "1px solid #dcebd8",
  borderRadius: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fcf6 55%)",
  padding: "12px 14px",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0b2210",
  fontSize: 12,
  fontWeight: 700,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  color: "#484f58",
  fontSize: 11,
  lineHeight: 1.5,
};

const kindChipStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.5,
  border: "1px solid",
  borderRadius: 20,
  padding: "1px 7px",
  textTransform: "uppercase",
};

const fieldsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 11,
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const fieldRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#484f58",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const idCodeStyle: CSSProperties = {
  fontSize: 11,
  color: "#9ecbff",
  background: "#ffffff",
  border: "1px solid #eef7eb",
  borderRadius: 6,
  padding: "4px 8px",
  fontFamily: "monospace",
  display: "block",
};

const inputStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 8,
  background: "#151d28",
  color: "#0b2210",
  padding: "6px 8px",
  fontSize: 12,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 8,
  background: "#151d28",
  color: "#0b2210",
  padding: "6px 8px",
  fontSize: 11,
  resize: "vertical",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  lineHeight: 1.5,
};

const optionsWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const optionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#151d28",
  border: "1px solid #2a3545",
  borderRadius: 8,
  padding: "5px 8px",
};

const optionNumStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  minWidth: 14,
  textAlign: "center",
};

const optionInputStyle: CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: "#0b2210",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  fontFamily: "inherit",
};

const optionRemoveStyle: CSSProperties = {
  fontSize: 9,
  color: "#484f58",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  lineHeight: 1,
};

const addOptBtnStyle: CSSProperties = {
  fontSize: 10,
  color: "#9254de",
  background: "#1a1328",
  border: "1px dashed #9254de66",
  borderRadius: 7,
  padding: "6px 8px",
  cursor: "pointer",
  textAlign: "left",
};

const deleteBtnStyle: CSSProperties = {
  border: "1px solid #f8514944",
  borderRadius: 6,
  background: "#f851491a",
  color: "#ff7b72",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  padding: "7px 10px",
  marginTop: 4,
};
