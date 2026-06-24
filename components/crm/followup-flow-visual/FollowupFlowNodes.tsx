"use client";

import { createContext, useContext, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Archive, Clock, Image as ImageIcon, MessageSquare, Play } from "lucide-react";
import type { FollowupFlowNodeData } from "./types";
import { summarizeFollowupText } from "./types";

export type FollowupNodeCallbacks = {
  onSelect: (passoId: string) => void;
  onSelectStart: () => void;
};

export const FollowupNodeCallbacksContext = createContext<FollowupNodeCallbacks>({
  onSelect: () => undefined,
  onSelectStart: () => undefined,
});

export const FollowupNodeThemeContext = createContext<"light" | "dark">("light");

export const FOLLOWUP_NODE_W = 300;

const KIND_THEME = {
  start: {
    border: "#2d7a36",
    headerBg: "#e8f5e9",
    headerText: "#1b5e20",
    badgeBg: "#a5d6a7",
    badgeText: "#1b5e20",
    label: "Gatilho",
    Icon: Play,
  },
  texto: {
    border: "#3f9848",
    headerBg: "#edf7ee",
    headerText: "#0b3d14",
    badgeBg: "#c8e6c9",
    badgeText: "#1b5e20",
    label: "Mensagem",
    Icon: MessageSquare,
  },
  imagem: {
    border: "#58a6ff",
    headerBg: "#e3f2fd",
    headerText: "#0d47a1",
    badgeBg: "#bbdefb",
    badgeText: "#1565c0",
    label: "Imagem",
    Icon: ImageIcon,
  },
  texto_imagem: {
    border: "#d4a017",
    headerBg: "#fff8e1",
    headerText: "#6d4c00",
    badgeBg: "#ffe082",
    badgeText: "#5d4037",
    label: "Imagem + legenda",
    Icon: ImageIcon,
  },
} as const;

const cardBase: CSSProperties = {
  width: FOLLOWUP_NODE_W,
  minWidth: FOLLOWUP_NODE_W,
  maxWidth: FOLLOWUP_NODE_W,
  background: "#ffffff",
  borderRadius: 14,
  overflow: "visible",
  position: "relative",
  fontFamily: "inherit",
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

const badgeStyle: CSSProperties = {
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

const stepTagStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#5d7a67",
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  borderRadius: 999,
  padding: "2px 7px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  fontWeight: 600,
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 10,
  lineHeight: 1.4,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const bodyBase: CSSProperties = {
  padding: "10px 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const contentBox: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#2d4a35",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  borderRadius: 8,
  padding: "7px 8px",
  background: "#f4faf2",
  border: "1px solid #dcebd8",
  minHeight: 42,
};

const legendText: CSSProperties = {
  margin: 0,
  fontSize: 10,
  color: "#7a9a7e",
  letterSpacing: 0.2,
  lineHeight: 1.35,
};

const metaLine: CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  color: "#5d7a67",
  display: "flex",
  alignItems: "center",
  gap: 4,
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

function BaseCard({
  selected,
  theme,
  stepTag,
  title,
  subtitle,
  content,
  meta,
  children,
  onClick,
  inactive,
}: {
  selected?: boolean;
  theme: (typeof KIND_THEME)[keyof typeof KIND_THEME];
  stepTag?: string;
  title: string;
  subtitle?: string;
  content?: string;
  meta?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  inactive?: boolean;
}) {
  const mode = useContext(FollowupNodeThemeContext);
  const isLight = mode === "light";
  const { Icon } = theme;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        ...cardBase,
        background: isLight ? "#ffffff" : inactive ? "rgba(6,13,8,0.72)" : "rgba(8,16,10,0.92)",
        border: selected
          ? `2px solid ${theme.border}`
          : isLight
            ? "1px solid #dcebd8"
            : `1px solid ${theme.border}66`,
        boxShadow: selected
          ? `0 0 0 2px ${theme.border}44, 0 8px 24px rgba(11, 34, 16, 0.12)`
          : isLight
            ? "0 4px 16px rgba(11, 34, 16, 0.08)"
            : "0 8px 24px rgba(0,0,0,0.28)",
        opacity: inactive ? 0.72 : 1,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ ...headerBase, background: theme.headerBg }}>
        <div style={badgeRow}>
          <span style={{ ...badgeStyle, background: theme.badgeBg, color: theme.badgeText }}>
            <Icon size={11} strokeWidth={2.2} />
            {theme.label}
          </span>
          {stepTag ? <span style={stepTagStyle}>{stepTag}</span> : null}
          {inactive ? (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b" }}>INACTIVO</span>
          ) : null}
        </div>
        <p style={{ ...titleStyle, color: theme.headerText }}>{title}</p>
        {subtitle ? (
          <p style={{ ...subtitleStyle, color: isLight ? "#5d7a67" : "#8b949e" }}>
            <Clock size={10} />
            {subtitle}
          </p>
        ) : null}
      </div>

      <div style={bodyBase}>
        {content ? <p style={contentBox}>{content}</p> : null}
        {meta ? (
          <p style={metaLine}>
            <Archive size={10} />
            {meta}
          </p>
        ) : null}
        {children}
        <p style={legendText}>Clique para editar</p>
      </div>
    </div>
  );
}

export function FollowupStartNode({ data, selected }: NodeProps) {
  const d = data as FollowupFlowNodeData;
  const theme = KIND_THEME.start;
  const { onSelectStart } = useContext(FollowupNodeCallbacksContext);

  return (
    <>
      <BaseCard
        selected={selected}
        theme={theme}
        title="Silêncio do cliente"
        subtitle={d.gatilhoLabel || "Configure o gatilho"}
        meta={d.textoPreview}
        onClick={() => onSelectStart()}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={handleStyle(theme.border, "bottom")}
      />
    </>
  );
}

export function FollowupPassoNode({ id, data, selected }: NodeProps) {
  const d = data as FollowupFlowNodeData;
  const theme = KIND_THEME[d.kind === "start" ? "texto" : d.kind] ?? KIND_THEME.texto;
  const { onSelect } = useContext(FollowupNodeCallbacksContext);
  const passoId = d.passoId ?? id;
  const preview = summarizeFollowupText(d.textoPreview ?? "", 88);

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle(theme.border, "top")} />
      <BaseCard
        selected={selected}
        theme={theme}
        stepTag={`passo_${d.ordem ?? "?"}`}
        title={`Passo ${d.ordem ?? "?"}`}
        subtitle={`+${d.atrasoLabel ?? "?"}`}
        content={preview}
        inactive={d.ativo === false}
        onClick={() => onSelect(passoId)}
      >
        {d.imagemUrl ? (
          <img
            src={d.imagemUrl}
            alt=""
            style={{
              width: "100%",
              height: 72,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #dcebd8",
            }}
          />
        ) : null}
      </BaseCard>
      <Handle type="source" position={Position.Bottom} style={handleStyle(theme.border, "bottom")} />
    </>
  );
}

export const FOLLOWUP_NODE_TYPES = {
  followupStart: FollowupStartNode,
  followupPasso: FollowupPassoNode,
};

/** Estilos partilhados para cards de passo no sideover (variante escura) ou no canvas (claro). */
export function followupPassoCardSurface(
  tipo: keyof typeof KIND_THEME,
  ativo: boolean,
  variant: "light" | "dark" = "light"
): {
  theme: (typeof KIND_THEME)[keyof typeof KIND_THEME];
  border: string;
  background: string;
  badgeBg: string;
  badgeText: string;
} {
  const theme = KIND_THEME[tipo] ?? KIND_THEME.texto;

  if (variant === "dark") {
    return {
      theme,
      border: ativo ? `${theme.border}66` : "rgba(146, 255, 0, 0.12)",
      background: ativo ? "rgba(6, 13, 8, 0.55)" : "rgba(6, 13, 8, 0.38)",
      badgeBg: `${theme.border}22`,
      badgeText: ativo ? theme.border : "#8b949e",
    };
  }

  return {
    theme,
    border: ativo ? `${theme.border}55` : "#dcebd8",
    background: ativo ? theme.headerBg : "#f8faf8",
    badgeBg: theme.badgeBg,
    badgeText: theme.badgeText,
  };
}
