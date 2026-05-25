"use client";

import type { CSSProperties, MouseEvent } from "react";
import { Pencil } from "lucide-react";
import {
  AgenteSideoverEntityCard,
  AgenteSideoverInfoGrid,
} from "@/components/crm/AgenteSideoverCards";
import { mercadoAccent, mercadoIcon } from "@/lib/crm/mercado-visual";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

const STATUS_COLOR: Record<string, string> = {
  aberto: "#3b82f6",
  em_negociacao: "#f59e0b",
  fechado_ganho: "#22c55e",
  fechado_perdido: "#ef4444",
  cancelado: "#8b949e",
};

export type NegocioKanbanCardData = {
  id: string;
  codigo: string;
  titulo: string;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  criado_em: string | null;
};

function moeda(v: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
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
  dragging?: boolean;
  draggable?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

const wrapStyle: CSSProperties = {
  cursor: "pointer",
  transition: "opacity 0.15s",
  borderRadius: 14,
};

const actionBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(56, 74, 102, 0.55)",
  background: "rgba(15, 20, 28, 0.85)",
  cursor: "pointer",
};

export function NegocioKanbanCard({
  negocio,
  dragging,
  draggable,
  onOpen,
  onEdit,
  onDragStart,
  onDragEnd,
}: Props) {
  const accent = mercadoAccent(negocio.prefixo_mercado);
  const Icon = mercadoIcon(negocio.prefixo_mercado);
  const statusColor = STATUS_COLOR[negocio.status] || "#8b949e";

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{
        ...wrapStyle,
        opacity: dragging ? 0.5 : 1,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <AgenteSideoverEntityCard
        accent={accent}
        Icon={Icon}
        fallbackProgress={0.42}
        avatarCaption={negocio.prefixo_mercado}
        footer={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: `${statusColor}18`,
                  color: statusColor,
                  border: `1px solid ${statusColor}44`,
                }}
              >
                {negocio.status.replace(/_/g, " ")}
              </span>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                {tempo(negocio.criado_em)}
              </span>
            </div>
            {onEdit ? (
              <button
                type="button"
                title="Editar"
                onClick={(e) => {
                  stop(e);
                  onEdit();
                }}
                style={actionBtn}
              >
                <Pencil size={14} strokeWidth={2.2} color="#c9a24a" />
              </button>
            ) : null}
          </div>
        }
      >
        <div style={{ marginBottom: 6 }}>
          <strong
            style={{
              color: "#e6edf3",
              fontSize: 13,
              letterSpacing: "-0.02em",
              display: "block",
              lineHeight: 1.25,
            }}
          >
            {negocio.titulo}
          </strong>
          <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 600 }}>
            {labelMercadoPrefixo(negocio.prefixo_mercado)}
          </span>
        </div>

        <p
          style={{
            margin: "0 0 8px",
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            color: "rgba(201, 162, 74, 0.92)",
          }}
        >
          {negocio.codigo}
        </p>

        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#22c55e" }}>
          {moeda(negocio.valor_fechado ?? negocio.valor_estimado)}
        </p>

        <AgenteSideoverInfoGrid
          rows={[
            { label: "Etapa", value: negocio.etapa },
            { label: "Mercado", value: negocio.prefixo_mercado },
            {
              label: "Previsão",
              value: negocio.data_previsao_fechamento
                ? new Date(negocio.data_previsao_fechamento).toLocaleDateString("pt-BR")
                : "—",
            },
          ]}
        />
      </AgenteSideoverEntityCard>
    </div>
  );
}
