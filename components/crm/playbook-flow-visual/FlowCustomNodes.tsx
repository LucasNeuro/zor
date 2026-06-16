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
    border: "#3f9848",
    headerBg: "#e8f5e9",
    headerText: "#0b3d14",
    badgeBg: "#c8e6c9",
    badgeText: "#1b5e20",
    label: "Mensagem",
    Icon: MessageSquare,
  },
  input: {
    border: "#d4a017",
    headerBg: "#fff8e1",
    headerText: "#6d4c00",
    badgeBg: "#ffe082",
    badgeText: "#5d4037",
    label: "Coleta",
    Icon: Pencil,
  },
  menu: {
    border: "#5c9c63",
    headerBg: "#edf7ee",
    headerText: "#1b4332",
    badgeBg: "#c8e6c9",
    badgeText: "#2e7d32",
    label: "Menu",
    Icon: ClipboardList,
  },
  complete: {
    border: "#2d7a36",
    headerBg: "#e8f5e9",
    headerText: "#1b5e20",
    badgeBg: "#a5d6a7",
    badgeText: "#1b5e20",
    label: "Conclusão",
    Icon: CheckCircle,
  },
  transfer: {
    border: "#4f46e5",
    headerBg: "#eef2ff",
    headerText: "#312e81",
    badgeBg: "#c7d2fe",
    badgeText: "#3730a3",
    label: "Transferir",
    Icon: Link2,
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
  isOrphan?: boolean;
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
  isOrphan = false,
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
        border: isOrphan
          ? "2px solid #f85149"
          : `1px solid ${selected ? theme.border : "#dcebd8"}`,
        boxShadow: isOrphan
          ? "0 0 0 2px rgba(248, 81, 73, 0.25), 0 8px 24px rgba(248, 81, 73, 0.12)"
          : selected
            ? `0 0 0 2px ${theme.border}44, 0 8px 24px rgba(11, 34, 16, 0.12)`
            : "0 4px 16px rgba(11, 34, 16, 0.08)",
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
      selected={selected} isConnectable={isConnectable} isOrphan={data.isOrphan === true} />
  );
}

export function InputNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="input" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} isOrphan={data.isOrphan === true} />
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

  const handleCount = Math.max(options.length, 1);

  return (
    <BaseCard id={id} kind="menu" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} showSourceHandle={false} isOrphan={data.isOrphan === true}>
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
      {options.map((opt, idx) => {
        const leftPct = ((idx + 1) / (handleCount + 1)) * 100;
        return (
          <Handle
            key={opt.id}
            type="source"
            id={opt.id}
            position={Position.Bottom}
            isConnectable={isConnectable}
            style={{
              ...handleStyle(KIND_THEME.menu.border, "bottom"),
              left: `${leftPct}%`,
              transform: "translate(-50%, 50%)",
            }}
          />
        );
      })}
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
      selected={selected} isConnectable={isConnectable} isOrphan={data.isOrphan === true} />
  );
}

export function TransferNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  const phone = data.notifyPhone?.trim();
  return (
    <BaseCard id={id} kind="transfer" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} isOrphan={data.isOrphan === true}>
      <p style={transferHintStyle}>
        {phone ? (
          <>
            Consultor: <strong>{phone}</strong>
          </>
        ) : (
          <span style={{ color: "#b45309" }}>Configure o WhatsApp do consultor</span>
        )}
      </p>
    </BaseCard>
  );
}

export const FLOW_NODE_TYPES = {
  message: MessageNode,
  input: InputNode,
  menu: MenuNode,
  complete: CompleteNode,
  transfer: TransferNode,
};

const cardBase: CSSProperties = {
  width: 300,
  minWidth: 300,
  maxWidth: 300,
  background: "#ffffff",
  borderRadius: 14,
  overflow: "visible",
  cursor: "default",
  position: "relative",
  fontFamily: "inherit",
};

const transferHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  color: "#4338ca",
  lineHeight: 1.4,
};

const headerBase: CSSProperties = {
  padding: "10px 12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  borderRadius: "13px 13px 0 0",
  borderBottom: "1px solid #e8f0e6",
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
  color: "#5d7a67",
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  borderRadius: 999,
  padding: "2px 7px",
};

const idCode: CSSProperties = {
  fontSize: 9.5,
  color: "#2d4a35",
  fontFamily: "inherit",
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
  background: "#ffffff",
  border: "1px solid #3f9848",
  borderRadius: 6,
  color: "#0b2210",
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
  color: "#7a9a7e",
  letterSpacing: 0.2,
  lineHeight: 1.35,
};

const contentDisplay: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#2d4a35",
  lineHeight: 1.55,
  cursor: "text",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  borderRadius: 8,
  padding: "7px 8px",
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  minHeight: 42,
};

const contentTextarea: CSSProperties = {
  fontSize: 12,
  color: "#0b2210",
  lineHeight: 1.55,
  background: "#ffffff",
  border: "1px solid #3f9848",
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
  border: "1px solid #ef9a9a",
  borderRadius: "50%",
  background: "#ffebee",
  color: "#c62828",
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
    border: "2px solid #ffffff",
    borderRadius: "50%",
    boxShadow: "0 0 0 2px #dcebd8",
  };
}

// Menu option styles

const optionsSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  borderTop: "1px solid #e8f0e6",
  paddingTop: 8,
};

const optionsSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#5d7a67",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 1,
};

const optRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  borderRadius: 7,
  padding: "4px 7px",
  minHeight: 27,
};

const optNum: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#6d4c9a",
  minWidth: 14,
  textAlign: "center",
};

const optLabel: CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: "#2d4a35",
  cursor: "text",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const optInput: CSSProperties = {
  flex: 1,
  fontSize: 10.5,
  color: "#0b2210",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  fontFamily: "inherit",
};

const optRemove: CSSProperties = {
  fontSize: 9.5,
  color: "#7a9a7e",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  display: "flex",
  alignItems: "center",
};

const addOptBtn: CSSProperties = {
  fontSize: 10.5,
  color: "#5c4d8a",
  background: "#f3f0fa",
  border: "1px dashed #b39ddb",
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
  color: "#0b2210",
  background: "#ffffff",
  border: "1px solid #b39ddb",
  borderRadius: 7,
  padding: "5px 7px",
  outline: "none",
  fontFamily: "inherit",
};

const addOptConfirm: CSSProperties = {
  color: "#2e7d32",
  background: "#e8f5e9",
  border: "1px solid #a5d6a7",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const addOptCancel: CSSProperties = {
  color: "#5d7a67",
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
