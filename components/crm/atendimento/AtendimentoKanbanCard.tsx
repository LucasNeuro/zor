"use client";

import type { MouseEvent } from "react";
import { Bot, MessageSquare, UserRound } from "lucide-react";
import { CrmKanbanEntityCard } from "@/components/crm/CrmKanbanEntityCard";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { CRM_KANBAN } from "@/lib/crm/crm-kanban-card-styles";
import type { CrmLeadRow } from "@/hooks/useCrmLeadsQueries";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { tempo } from "@/lib/crm/atendimento-shared";

type Props = {
  lead: CrmLeadRow;
  stageLabel?: string | null;
  stageColor?: string;
  dragging?: boolean;
  isMobile?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onOpen?: () => void;
  onOpenChat?: () => void;
};

export function AtendimentoKanbanCard({
  lead,
  stageLabel,
  stageColor,
  dragging,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
  onOpenChat,
}: Props) {
  const humano = effectiveHumanoResponsavel(lead.humano_responsavel);
  const preview = lead.ultima_mensagem_fila?.trim() || null;
  const atualizado = lead.ultima_mensagem_fila_em || lead.atualizado_em;

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return (
    <CrmKanbanEntityCard
      seed={lead.id}
      nome={lead.nome}
      codigo={lead.codigo || lead._pessoa_codigo}
      subtitle={lead.telefone || lead.email || undefined}
      preview={preview}
      statusLabel={humano ? "HUMANO" : lead.agente_responsavel ? "IA" : "FILA"}
      statusActive={Boolean(humano || lead.agente_responsavel)}
      stageLabel={stageLabel}
      stageColor={stageColor}
      metrics={[
        ...(humano
          ? [{ label: "Consultor", value: formatHumanoDisplayName(humano), icon: UserRound }]
          : lead.agente_responsavel
            ? [{ label: "Agente", value: lead.agente_responsavel, icon: Bot }]
            : []),
        { label: "Atualizado", value: tempo(atualizado) },
      ]}
      dragging={dragging}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      footer={
        <>
          <span style={{ color: CRM_KANBAN.muted, fontSize: 10, fontWeight: 600, marginRight: 4 }}>
            {tempo(atualizado)}
          </span>
          {onOpenChat ? (
            <CrmIconButtonGroup
              items={[
                {
                  key: "chat",
                  variant: "green",
                  icon: <MessageSquare size={15} strokeWidth={2.2} />,
                  onClick: (e) => {
                    stop(e);
                    onOpenChat();
                  },
                  title: "Abrir chat",
                  "aria-label": "Abrir chat de atendimento",
                },
              ]}
              aria-label="Ações de atendimento"
            />
          ) : null}
        </>
      }
    />
  );
}
