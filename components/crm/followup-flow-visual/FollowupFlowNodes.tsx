"use client";

import { createContext, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bell, Image as ImageIcon, MessageSquare, Play } from "lucide-react";
import type { FollowupFlowNodeData } from "./types";
import { summarizeFollowupText } from "./types";

export type FollowupNodeCallbacks = {
  onSelect: (passoId: string) => void;
};

export const FollowupNodeCallbacksContext = createContext<FollowupNodeCallbacks>({
  onSelect: () => undefined,
});

const NODE_W = 280;

const KIND_THEME = {
  start: {
    border: "#3fb950",
    headerBg: "rgba(63,185,80,0.16)",
    label: "Início",
    Icon: Play,
  },
  texto: {
    border: "#92ff00",
    headerBg: "rgba(146,255,0,0.12)",
    label: "Texto",
    Icon: MessageSquare,
  },
  imagem: {
    border: "#58a6ff",
    headerBg: "rgba(88,166,255,0.12)",
    label: "Imagem",
    Icon: ImageIcon,
  },
  texto_imagem: {
    border: "#c9a24a",
    headerBg: "rgba(201,162,74,0.14)",
    label: "Imagem + legenda",
    Icon: ImageIcon,
  },
} as const;

function BaseCard({
  selected,
  border,
  headerBg,
  label,
  Icon,
  title,
  subtitle,
  children,
  onClick,
  inactive,
}: {
  selected?: boolean;
  border: string;
  headerBg: string;
  label: string;
  Icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  inactive?: boolean;
}) {
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
        width: NODE_W,
        borderRadius: 12,
        border: `2px solid ${selected ? "#c9a24a" : border}`,
        background: inactive ? "rgba(6,13,8,0.72)" : "rgba(8,16,10,0.92)",
        boxShadow: selected ? "0 0 0 2px rgba(201,162,74,0.35)" : "0 8px 24px rgba(0,0,0,0.28)",
        opacity: inactive ? 0.72 : 1,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: headerBg,
          borderBottom: `1px solid ${border}55`,
        }}
      >
        <Icon size={14} strokeWidth={2.2} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.04, textTransform: "uppercase" }}>
          {label}
        </span>
        {inactive ? (
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#8b949e" }}>INACTIVO</span>
        ) : null}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#e6edf3" }}>{title}</p>
        {subtitle ? (
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8b949e", lineHeight: 1.4 }}>{subtitle}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function FollowupStartNode({ selected }: NodeProps) {
  return (
    <>
      <BaseCard
        selected={selected}
        border={KIND_THEME.start.border}
        headerBg={KIND_THEME.start.headerBg}
        label={KIND_THEME.start.label}
        Icon={KIND_THEME.start.Icon}
        title="Cliente parou de responder"
        subtitle="O cron percorre os passos abaixo na ordem."
      />
      <Handle type="source" position={Position.Bottom} style={{ background: "#3fb950", width: 8, height: 8 }} />
    </>
  );
}

export function FollowupPassoNode({ id, data, selected }: NodeProps) {
  const d = data as FollowupFlowNodeData;
  const theme = KIND_THEME[d.kind === "start" ? "texto" : d.kind] ?? KIND_THEME.texto;
  const { onSelect } = useContext(FollowupNodeCallbacksContext);
  const passoId = d.passoId ?? id;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: theme.border, width: 8, height: 8 }} />
      <BaseCard
        selected={selected}
        border={theme.border}
        headerBg={theme.headerBg}
        label={theme.label}
        Icon={theme.Icon}
        title={`Passo ${d.ordem ?? "?"}`}
        subtitle={`Após +${d.atrasoLabel ?? "?"} sem resposta`}
        inactive={d.ativo === false}
        onClick={() => onSelect(passoId)}
      >
        {d.imagemUrl ? (
          <img
            src={d.imagemUrl}
            alt=""
            style={{
              marginTop: 8,
              width: "100%",
              height: 72,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid rgba(146,255,0,0.2)",
            }}
          />
        ) : null}
        <p
          style={{
            margin: d.imagemUrl ? "8px 0 0" : "8px 0 0",
            fontSize: 11,
            color: "#c9d1d9",
            lineHeight: 1.45,
          }}
        >
          {summarizeFollowupText(d.textoPreview ?? "")}
        </p>
      </BaseCard>
      <Handle type="source" position={Position.Bottom} style={{ background: theme.border, width: 8, height: 8 }} />
    </>
  );
}

export const FOLLOWUP_NODE_TYPES = {
  followupStart: FollowupStartNode,
  followupPasso: FollowupPassoNode,
};

export function FollowupFlowLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10, color: "#8b949e" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Bell size={12} /> Clique num passo para editar
      </span>
    </div>
  );
}
