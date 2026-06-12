"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  CheckCircle,
  ClipboardList,
  Link2,
  MessageSquare,
  Plus,
  Check,
  Pencil,
  X,
} from "lucide-react";
import type { FlowMenuOption, FlowNodeKind, FlowVisualNodeData } from "./types";

// ─── Context ─────────────────────────────────────────────────────────────────

export type NodeCallbacks = {
  onUpdate: (nodeId: string, updates: Partial<FlowVisualNodeData>) => void;
  onDelete: (nodeId: string) => void;
  /** Remove opção do menu e a aresta associada (evita ressuscitar opção no JSON). */
  onRemoveMenuOption: (nodeId: string, optionId: string) => void;
};

export const FlowNodeCallbacksContext = createContext<NodeCallbacks>({
  onUpdate: () => undefined,
  onDelete: () => undefined,
  onRemoveMenuOption: () => undefined,
});

// ─── Theme ───────────────────────────────────────────────────────────────────

type KindTheme = {
  border: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  Icon: React.ComponentType<{ size: number; strokeWidth: number }>;
};

const KIND_THEME: Record<FlowNodeKind, KindTheme> = {
  message: {
    border: "#92ff00",
    headerBg: "#0b1f10",
    headerText: "#d4ffc4",
    badgeBg: "#1a4d22",
    badgeText: "#e8f5e9",
    label: "Mensagem",
    Icon: MessageSquare,
  },
  input: {
    border: "#d4a017",
    headerBg: "#1f1808",
    headerText: "#f5e6b8",
    badgeBg: "#5c4510",
    badgeText: "#fff8e6",
    label: "Coleta",
    Icon: Pencil,
  },
  menu: {
    border: "#3f9848",
    headerBg: "#0d1f12",
    headerText: "#b8e8bc",
    badgeBg: "#1e5c28",
    badgeText: "#dcfce7",
    label: "Menu",
    Icon: ClipboardList,
  },
  complete: {
    border: "#92ff00",
    headerBg: "#112a14",
    headerText: "#c8ffb0",
    badgeBg: "#2d6b1f",
    badgeText: "#e8ffe0",
    label: "Conclusão",
    Icon: CheckCircle,
  },
};

// ─── Inline edit hook ────────────────────────────────────────────────────────

function useInlineEdit(initial: string, onSave: (v: string) => void) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  function startEdit() {
    setValue(initial);
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    if (value !== initial) onSave(value);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setValue(initial);
    }
  }

  return { editing, value, setValue, ref, startEdit, commit, onKeyDown };
}

// ─── Base card ───────────────────────────────────────────────────────────────

type BaseCardProps = {
  id: string;
  kind: FlowNodeKind;
  title?: string;
  content: string;
  selected: boolean;
  isConnectable: boolean;
  children?: React.ReactNode;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
};

function BaseCard({
  id,
  kind,
  title,
  content,
  selected,
  isConnectable,
  children,
  showTargetHandle = true,
  showSourceHandle = true,
}: BaseCardProps) {
  const { onUpdate, onDelete } = useContext(FlowNodeCallbacksContext);
  const [hovered, setHovered] = useState(false);
  const theme = KIND_THEME[kind];
  const { Icon } = theme;

  const titleEdit = useInlineEdit(title ?? "", (v) => onUpdate(id, { title: v }));
  const contentEdit = useInlineEdit(content, (v) => onUpdate(id, { content: v }));

  return (
    <div
      style={{
        ...cardBase,
        border: `1px solid ${selected ? "#334155" : `${theme.border}88`}`,
        boxShadow: selected
          ? `0 0 0 2px ${theme.border}55, 0 12px 34px #02061799`
          : "0 8px 24px #02061780",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          style={handleStyle(theme.border, "top")}
        />
      )}

      {/* Header */}
      <div style={{ ...headerBase, background: theme.headerBg }}>
        <div style={badgeRow}>
          <span style={{ ...badge, background: theme.badgeBg, color: theme.badgeText }}>
            <Icon size={11} strokeWidth={2.2} />
            {theme.label}
          </span>
          <span style={idTag}>
            <Link2 size={10} strokeWidth={2.3} />
            <code style={idCode}>{id}</code>
          </span>
        </div>

        {/* Editable title */}
        {titleEdit.editing ? (
          <input
            ref={titleEdit.ref as React.RefObject<HTMLInputElement>}
            value={titleEdit.value}
            onChange={(e) => titleEdit.setValue(e.target.value)}
            onBlur={titleEdit.commit}
            onKeyDown={titleEdit.onKeyDown}
            style={titleInput}
            placeholder="Título do passo…"
          />
        ) : (
          <p
            style={{ ...titleDisplay, color: theme.headerText }}
            onClick={titleEdit.startEdit}
            title="Clique para editar o título"
          >
            {title?.trim() || <span style={{ opacity: 0.35 }}>sem título</span>}
          </p>
        )}
      </div>

      {/* Body */}
      <div style={bodyBase}>
        {/* Editable content */}
        {contentEdit.editing ? (
          <textarea
            ref={contentEdit.ref as React.RefObject<HTMLTextAreaElement>}
            value={contentEdit.value}
            onChange={(e) => contentEdit.setValue(e.target.value)}
            onBlur={contentEdit.commit}
            onKeyDown={contentEdit.onKeyDown}
            style={contentTextarea}
            rows={3}
          />
        ) : (
          <p
            style={contentDisplay}
            onClick={contentEdit.startEdit}
            title="Clique para editar o conteúdo"
          >
            {content?.trim() || <span style={{ opacity: 0.35 }}>sem conteúdo</span>}
          </p>
        )}

        {children}
        <p style={legendText}>Clique para editar · X para remover</p>
      </div>

      {/* Delete */}
      {(hovered || selected) && (
        <button
          type="button"
          onClick={() => onDelete(id)}
          style={deleteBtn}
          title="Remover nó"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}

      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          style={handleStyle(theme.border, "bottom")}
        />
      )}
    </div>
  );
}

// ─── Node components ─────────────────────────────────────────────────────────

export function MessageNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="message" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} />
  );
}

export function InputNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="input" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} />
  );
}

export function MenuNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  const { onUpdate, onRemoveMenuOption } = useContext(FlowNodeCallbacksContext);
  const [addingOption, setAddingOption] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const options: FlowMenuOption[] = (data.menuOptions as FlowMenuOption[] | undefined) ?? [];

  function updateLabel(optId: string, label: string) {
    onUpdate(id, { menuOptions: options.map((o) => (o.id === optId ? { ...o, label } : o)) });
  }

  function removeOption(optId: string) {
    if (options.length <= 1) return;
    onRemoveMenuOption(id, optId);
  }

  function addOption() {
    if (!newLabel.trim()) return;
    onUpdate(id, {
      menuOptions: [...options, { id: `opcao_${Date.now()}`, label: newLabel.trim() }],
    });
    setNewLabel("");
    setAddingOption(false);
  }

  return (
    <BaseCard id={id} kind="menu" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable}>
      <div style={optionsSection}>
        <span style={optionsSectionLabel}>Opções do menu</span>
        {options.map((opt, idx) => (
          <OptionRow key={opt.id} option={opt} index={idx}
            onUpdate={(l) => updateLabel(opt.id, l)}
            onRemove={() => removeOption(opt.id)} />
        ))}
        {addingOption ? (
          <div style={addOptRow}>
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addOption();
                if (e.key === "Escape") { setAddingOption(false); setNewLabel(""); }
              }}
              placeholder="Label da opção…"
              style={addOptInput}
            />
            <button type="button" onClick={addOption} style={addOptConfirm}>
              <Check size={10} strokeWidth={2.4} />
            </button>
            <button type="button" onClick={() => { setAddingOption(false); setNewLabel(""); }} style={addOptCancel}><X size={10} strokeWidth={2} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingOption(true)} style={addOptBtn}>
            <Plus size={11} strokeWidth={2.2} />
            Adicionar opção
          </button>
        )}
      </div>
    </BaseCard>
  );
}

type OptionRowProps = { option: FlowMenuOption; index: number; onUpdate: (l: string) => void; onRemove: () => void };

function OptionRow({ option, index, onUpdate, onRemove }: OptionRowProps) {
  const edit = useInlineEdit(option.label, onUpdate);
  return (
    <div style={optRow}>
      <span style={optNum}>{index + 1}</span>
      {edit.editing ? (
        <input
          ref={edit.ref as React.RefObject<HTMLInputElement>}
          value={edit.value}
          onChange={(e) => edit.setValue(e.target.value)}
          onBlur={edit.commit}
          onKeyDown={edit.onKeyDown}
          style={optInput}
        />
      ) : (
        <span style={optLabel} onClick={edit.startEdit} title="Clique para editar">
          {option.label}
        </span>
      )}
      <button type="button" onClick={onRemove} style={optRemove} title="Remover opção">
        <X size={9} strokeWidth={2} />
      </button>
    </div>
  );
}

export function CompleteNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="complete" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} showSourceHandle={false} />
  );
}

// ─── nodeTypes registry ───────────────────────────────────────────────────────

export const FLOW_NODE_TYPES = {
  message: MessageNode,
  input: InputNode,
  menu: MenuNode,
  complete: CompleteNode,
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardBase: CSSProperties = {
  width: 300,
  minWidth: 300,
  maxWidth: 300,
  background: "#101f14",
  borderRadius: 14,
  overflow: "visible",
  cursor: "default",
  position: "relative",
  fontFamily: "inherit",
};

const headerBase: CSSProperties = {
  padding: "10px 12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  borderRadius: "13px 13px 0 0",
  borderBottom: "1px solid #22314a",
};

const badgeRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "space-between",
};

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px 2px 6px",
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.3,
  lineHeight: 1.6,
};

const idTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "#94a3b8",
  background: "#0b1220",
  border: "1px solid #334155",
  borderRadius: 999,
  padding: "2px 7px",
};

const idCode: CSSProperties = {
  fontSize: 9.5,
  color: "#cbd5e1",
  fontFamily: "monospace",
  lineHeight: 1,
  flexShrink: 1,
  maxWidth: 94,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const titleDisplay: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "text",
  lineHeight: 1.35,
  wordBreak: "break-word",
  paddingBottom: 2,
  borderBottom: "1px dashed transparent",
};

const titleInput: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  background: "#0f172a",
  border: "1px solid #60a5fa",
  borderRadius: 6,
  color: "#e2e8f0",
  padding: "5px 7px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

const bodyBase: CSSProperties = {
  padding: "10px 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const legendText: CSSProperties = {
  margin: 0,
  fontSize: 10,
  color: "#7b8da7",
  letterSpacing: 0.2,
  lineHeight: 1.35,
};

const contentDisplay: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#cbd5e1",
  lineHeight: 1.55,
  cursor: "text",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  borderRadius: 8,
  padding: "7px 8px",
  background: "#111b2f",
  border: "1px solid #2c3e5d",
  minHeight: 42,
};

const contentTextarea: CSSProperties = {
  fontSize: 12,
  color: "#e2e8f0",
  lineHeight: 1.55,
  background: "#0f172a",
  border: "1px solid #60a5fa",
  borderRadius: 8,
  padding: "7px 8px",
  resize: "vertical",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
  minHeight: 60,
  fontFamily: "inherit",
};

const deleteBtn: CSSProperties = {
  position: "absolute",
  top: 9,
  right: 9,
  width: 22,
  height: 22,
  border: "1px solid #ef444488",
  borderRadius: "50%",
  background: "#2a1313",
  color: "#fca5a5",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  zIndex: 10,
};

function handleStyle(color: string, pos: "top" | "bottom"): CSSProperties {
  return {
    [pos]: -8,
    width: 14,
    height: 14,
    background: color,
    border: "2px solid #0b1220",
    borderRadius: "50%",
    boxShadow: "0 0 0 3px #0f172a",
  };
}

// Menu option styles

const optionsSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  borderTop: "1px solid #22314a",
  paddingTop: 8,
};

const optionsSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 1,
};

const optRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#111b2f",
  border: "1px solid #2c3e5d",
  borderRadius: 7,
  padding: "4px 7px",
  minHeight: 27,
};

const optNum: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#7c3aed",
  minWidth: 14,
  textAlign: "center",
};

const optLabel: CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: "#cbd5e1",
  cursor: "text",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const optInput: CSSProperties = {
  flex: 1,
  fontSize: 10.5,
  color: "#e2e8f0",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  fontFamily: "inherit",
};

const optRemove: CSSProperties = {
  fontSize: 9.5,
  color: "#94a3b8",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  display: "flex",
  alignItems: "center",
};

const addOptBtn: CSSProperties = {
  fontSize: 10.5,
  color: "#c4b5fd",
  background: "#1f1638",
  border: "1px dashed #a78bfa",
  borderRadius: 7,
  padding: "6px 8px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const addOptRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const addOptInput: CSSProperties = {
  flex: 1,
  fontSize: 10.5,
  color: "#e2e8f0",
  background: "#0f172a",
  border: "1px solid #a78bfa",
  borderRadius: 7,
  padding: "5px 7px",
  outline: "none",
  fontFamily: "inherit",
};

const addOptConfirm: CSSProperties = {
  color: "#bbf7d0",
  background: "#123322",
  border: "1px solid #166534",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const addOptCancel: CSSProperties = {
  color: "#94a3b8",
  background: "#111b2f",
  border: "1px solid #334155",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
