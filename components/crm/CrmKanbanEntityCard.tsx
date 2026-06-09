"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AgenteAvatar } from "@/components/crm/AgenteAvatar";
import {
  CRM_KANBAN,
  crmKanbanCardShell,
  crmKanbanStatusPill,
} from "@/lib/crm/crm-kanban-card-styles";

export type CrmKanbanMetric = {
  label: string;
  value: string;
  color?: string;
  icon?: LucideIcon;
};
type Props = {
  seed: string;
  nome: string;
  codigo?: string | null;
  subtitle?: string | null;
  preview?: string | null;
  statusLabel?: string;
  statusActive?: boolean;
  metrics?: CrmKanbanMetric[];
  progressPct?: number;
  /** Conteúdo extra acima do rodapé (ex.: anotações colapsáveis). */
  extra?: ReactNode;
  footer?: ReactNode;
  dragging?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  accentBorder?: string;
  stageLabel?: string | null;
  stageColor?: string;
  stageIcon?: LucideIcon;
};

export function CrmKanbanEntityCard({
  seed,
  nome,
  codigo,
  subtitle,
  preview,
  statusLabel = "ACTIVO",
  statusActive = true,
  metrics = [],
  progressPct,
  extra,
  footer,
  dragging,
  draggable,
  onClick,
  onDragStart,
  onDragEnd,
  accentBorder,
  stageLabel,
  stageColor,
  stageIcon: StageIcon,
}: Props) {
  const pct =
    typeof progressPct === "number" && Number.isFinite(progressPct)
      ? Math.min(100, Math.max(0, Math.round(progressPct)))
      : null;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        ...crmKanbanCardShell(false),
        opacity: dragging ? 0.55 : 1,
        borderLeft: accentBorder ? `3px solid ${accentBorder}` : undefined,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(15, 56, 39, 0.11)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(15, 56, 39, 0.07)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <AgenteAvatar
          seed={seed}
          nome={nome}
          size={52}
          shape="circle"
          status={statusActive ? "ativo" : "inativo"}
          progress={pct != null ? pct / 100 : null}
          alt={nome}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: CRM_KANBAN.title,
                fontWeight: 800,
                fontSize: 14,
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {nome}
            </p>
            {statusLabel ? (
              <span style={crmKanbanStatusPill(statusActive)}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusActive ? CRM_KANBAN.accent : "#94a3b8",
                    boxShadow: statusActive ? `0 0 6px ${CRM_KANBAN.accent}` : undefined,
                  }}
                />
                {statusLabel}
              </span>
            ) : null}
          </div>
          {codigo ? (
            <p
              style={{
                margin: "4px 0 0",
                color: CRM_KANBAN.muted,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: CRM_KANBAN.mono,
                letterSpacing: 0.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {codigo}
            </p>
          ) : null}
          {subtitle ? (
            <p
              style={{
                margin: "4px 0 0",
                color: CRM_KANBAN.body,
                fontSize: 11,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {preview ? (
        <p
          style={{
            fontSize: 12,
            color: CRM_KANBAN.body,
            margin: 0,
            lineHeight: 1.5,
            minHeight: 36,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </p>
      ) : null}

      {metrics.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: metrics.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
          {metrics.slice(0, 2).map((m) => {
            const MetricIcon = m.icon;
            return (
              <div
                key={m.label}
                style={{
                  background: "rgba(18, 56, 43, 0.04)",
                  border: "1px solid rgba(18, 56, 43, 0.1)",
                  borderRadius: 12,
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {MetricIcon ? (
                    <MetricIcon size={11} strokeWidth={2.2} color={m.color || CRM_KANBAN.muted} />
                  ) : null}
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.7, color: CRM_KANBAN.muted }}>
                    {m.label}
                  </p>
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 13,
                    fontWeight: 800,
                    color: m.color || CRM_KANBAN.title,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.value}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {pct != null ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: CRM_KANBAN.title }}>Score</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: CRM_KANBAN.accent }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(18, 56, 43, 0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 999,
                background: `linear-gradient(90deg, #3f9848 0%, ${CRM_KANBAN.accent} 100%)`,
              }}
            />
          </div>
        </div>
      ) : null}

      {extra ? <div style={{ marginTop: 4 }}>{extra}</div> : null}

      {footer ? (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
            borderTop: "1px solid rgba(18, 56, 43, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {stageLabel && StageIcon ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: `${stageColor || CRM_KANBAN.muted}14`,
                color: stageColor || CRM_KANBAN.body,
                border: `1px solid ${(stageColor || CRM_KANBAN.muted)}33`,
                maxWidth: "55%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <StageIcon size={12} strokeWidth={2.2} />
              {stageLabel}
            </span>
          ) : (
            <span />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

export function crmKanbanFooterBtn(
  onClick: (e: MouseEvent) => void,
  children: ReactNode,
  variant: "default" | "whatsapp" = "default"
): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 10,
        border: "1px solid rgba(18, 56, 43, 0.14)",
        background: variant === "whatsapp" ? "rgba(37, 211, 102, 0.12)" : "#f6faf4",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
