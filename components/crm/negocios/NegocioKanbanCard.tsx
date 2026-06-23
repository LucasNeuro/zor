"use client";

import type { MouseEvent } from "react";
import { Folder, Pencil } from "lucide-react";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { LeadNotesCollapsible } from "@/components/crm/leads/LeadNotesCollapsible";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";
import {
  CRM_KANBAN,
  crmKanbanCardShell,
  crmKanbanStatusPill,
} from "@/lib/crm/crm-kanban-card-styles";
import { estagioIcon } from "@/lib/crm/pipeline-card-icons";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_negociacao: "Em negociação",
  fechado_ganho: "Ganho",
  fechado_perdido: "Perdido",
  cancelado: "Cancelado",
};

export type NegocioKanbanCardData = {
  id: string;
  codigo: string;
  titulo: string;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  etapa_label?: string | null;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  criado_em: string | null;
};

function moeda(v: number | null) {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v);
}

function tempo(iso: string | null) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

type Props = {
  negocio: NegocioKanbanCardData;
  notas?: NotaPreview[];
  stageColor?: string;
  dragging?: boolean;
  draggable?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

export function NegocioKanbanCard({
  negocio,
  notas = [],
  stageColor = "#6b7280",
  dragging,
  draggable,
  onOpen,
  onEdit,
  onDragStart,
  onDragEnd,
}: Props) {
  const statusLabel = STATUS_LABEL[negocio.status] || negocio.status.replace(/_/g, " ");
  const statusActive = negocio.status !== "fechado_perdido" && negocio.status !== "cancelado";
  const valor = moeda(negocio.valor_fechado ?? negocio.valor_estimado);
  const etapaNome = negocio.etapa_label || negocio.etapa.replace(/_/g, " ");
  const StageIcon = estagioIcon(negocio.etapa);
  const previsao = negocio.data_previsao_fechamento
    ? new Date(negocio.data_previsao_fechamento).toLocaleDateString("pt-BR")
    : null;

  const metaParts = [valor, previsao].filter(Boolean);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        ...crmKanbanCardShell(false),
        padding: 14,
        gap: 10,
        opacity: dragging ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 10px 28px rgba(15, 56, 39, 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(15, 56, 39, 0.07)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(18, 56, 43, 0.06)",
            border: "1px solid rgba(18, 56, 43, 0.1)",
            color: stageColor || CRM_KANBAN.accent,
          }}
          aria-hidden
        >
          <Folder size={20} strokeWidth={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: CRM_KANBAN.title,
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {negocio.titulo}
            </p>
            <span style={crmKanbanStatusPill(statusActive)}>{statusLabel.toUpperCase()}</span>
          </div>

          {negocio.codigo ? (
            <p
              style={{
                margin: "3px 0 0",
                color: CRM_KANBAN.muted,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: CRM_KANBAN.mono,
                letterSpacing: 0.2,
              }}
            >
              {negocio.codigo}
            </p>
          ) : null}

          {metaParts.length > 0 ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                fontWeight: 700,
                color: valor ? "#16a34a" : CRM_KANBAN.body,
                lineHeight: 1.35,
              }}
            >
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {notas.length > 0 ? <LeadNotesCollapsible notas={notas} /> : null}

      <div
        style={{
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid rgba(18, 56, 43, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            color: stageColor || CRM_KANBAN.body,
            maxWidth: "58%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <StageIcon size={12} strokeWidth={2.2} />
          {etapaNome}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ color: CRM_KANBAN.muted, fontSize: 10, fontWeight: 600 }}>
            {tempo(negocio.criado_em)}
          </span>
          {onEdit ? (
            <CrmIconButtonGroup
              aria-label="Ações do negócio"
              items={[
                {
                  key: "edit",
                  variant: "outline",
                  icon: <Pencil size={14} strokeWidth={2.2} />,
                  onClick: (e) => {
                    stop(e);
                    onEdit();
                  },
                  title: "Editar",
                  "aria-label": "Editar negócio",
                },
              ]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
