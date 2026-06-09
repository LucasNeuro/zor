"use client";

import type { MouseEvent } from "react";
import { Banknote, Calendar, Pencil } from "lucide-react";
import { CrmKanbanEntityCard } from "@/components/crm/CrmKanbanEntityCard";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { LeadNotesCollapsible } from "@/components/crm/leads/LeadNotesCollapsible";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";
import { CRM_KANBAN } from "@/lib/crm/crm-kanban-card-styles";
import { estagioIcon } from "@/lib/crm/pipeline-card-icons";

const STATUS_COLOR: Record<string, string> = {
  aberto: "#3b82f6",
  em_negociacao: "#f59e0b",
  fechado_ganho: "#22c55e",
  fechado_perdido: "#ef4444",
  cancelado: "#6b8a76",
};

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
  const statusColor = STATUS_COLOR[negocio.status] || CRM_KANBAN.muted;
  const statusLabel = STATUS_LABEL[negocio.status] || negocio.status.replace(/_/g, " ");
  const valor = negocio.valor_fechado ?? negocio.valor_estimado;
  const etapaNome = negocio.etapa_label || negocio.etapa;
  const StageIcon = estagioIcon(negocio.etapa);
  const previsao = negocio.data_previsao_fechamento
    ? new Date(negocio.data_previsao_fechamento).toLocaleDateString("pt-BR")
    : "—";

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <CrmKanbanEntityCard
      seed={negocio.id}
      nome={negocio.titulo}
      codigo={negocio.codigo}
      subtitle={statusLabel}
      statusLabel={statusLabel.toUpperCase()}
      statusActive={negocio.status !== "fechado_perdido" && negocio.status !== "cancelado"}
      metrics={[
        { label: "VALOR", value: moeda(valor), color: "#22c55e", icon: Banknote },
        { label: "PREVISÃO", value: previsao, icon: Calendar },
      ]}
      stageLabel={etapaNome}
      stageColor={stageColor}
      stageIcon={StageIcon}
      dragging={dragging}
      draggable={draggable}
      onClick={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      extra={notas.length > 0 ? <LeadNotesCollapsible notas={notas} /> : undefined}
      footer={
        <>
          <span style={{ color: CRM_KANBAN.muted, fontSize: 10, fontWeight: 600, marginRight: 4 }}>
            {tempo(negocio.criado_em)}
          </span>
          {onEdit ? (
            <CrmIconButtonGroup
              aria-label="Ações do negócio"
              items={[
                {
                  key: "edit",
                  variant: "outline",
                  icon: <Pencil size={15} strokeWidth={2.2} />,
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
        </>
      }
    />
  );
}
