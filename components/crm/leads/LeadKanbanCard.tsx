"use client";

import type { MouseEvent } from "react";
import { MessageCircle, Pencil, Banknote } from "lucide-react";
import { CrmKanbanEntityCard } from "@/components/crm/CrmKanbanEntityCard";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { LeadNotesCollapsible } from "@/components/crm/leads/LeadNotesCollapsible";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";
import { CRM_KANBAN } from "@/lib/crm/crm-kanban-card-styles";
import { estagioIcon, origemIcon } from "@/lib/crm/pipeline-card-icons";
import { leadCanalExibicao } from "@/lib/crm/lead-canal-exibicao";

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  interno: "Interno (teste)",
  simulacao_ia: "Simulação IA",
  outro: "Outro",
};

const ORIGENS_COLOR: Record<string, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  meta_ads: "#1877F2",
  google_ads: "#EA4335",
  linkedin: "#0A66C2",
  site: "#6366F1",
  indicacao: "#F59E0B",
  interno: "#94a3b8",
  simulacao_ia: "#94a3b8",
  outro: "#6B7280",
};

export type LeadKanbanCardData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  estagio: string;
  score: number;
  valor_estimado: number;
  agente_responsavel: string | null;
  criado_em: string;
  atualizado_em: string;
  codigo?: string | null;
  metadata?: unknown;
  _pessoa_codigo?: string | null;
  _email_exibicao?: string | null;
  ultima_mensagem_fila?: string | null;
  ultima_mensagem_fila_em?: string | null;
  pessoa_cidade?: string | null;
  pessoa_estado?: string | null;
  proxima_acao?: string | null;
};

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);
}

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function linhaUnica(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

type Props = {
  lead: LeadKanbanCardData;
  notas?: NotaPreview[];
  stageLabel?: string | null;
  stageColor?: string;
  dragging?: boolean;
  isMobile?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

export function LeadKanbanCard({
  lead,
  notas = [],
  stageLabel,
  stageColor = "#6b7280",
  dragging,
  isMobile,
  onOpen,
  onEdit,
  draggable,
  onDragStart,
  onDragEnd,
}: Props) {
  const canal = leadCanalExibicao(lead);
  const origemCor = ORIGENS_COLOR[canal.origem] || ORIGENS_COLOR[lead.origem || ""] || "#6B7280";
  const OrigemIcon = origemIcon(canal.origem);
  const StageIcon = estagioIcon(lead.estagio);
  const local = [lead.pessoa_cidade, lead.pessoa_estado].filter(Boolean).join(" / ") || null;
  const preview =
    lead.ultima_mensagem_fila?.trim() ||
    lead.proxima_acao?.trim() ||
    null;
  const codigo = lead.codigo || lead._pessoa_codigo || null;
  const contato = lead.telefone || lead._email_exibicao || local || "Sem contato";
  const origemLabel = canal.label;

  const metrics = [
    {
      label: "ORIGEM",
      value: origemLabel,
      color: origemCor,
      icon: OrigemIcon,
    },
    {
      label: lead.valor_estimado > 0 ? "VALOR" : "CONTATO",
      value: lead.valor_estimado > 0 ? moeda(lead.valor_estimado) : linhaUnica(contato, 16),
      color: lead.valor_estimado > 0 ? "#22c55e" : CRM_KANBAN.title,
      icon: lead.valor_estimado > 0 ? Banknote : OrigemIcon,
    },
  ];

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  const actionItems = [
    ...(onEdit
      ? [
          {
            key: "edit",
            variant: "outline" as const,
            icon: <Pencil size={15} strokeWidth={2.2} />,
            onClick: (e: MouseEvent<HTMLButtonElement>) => {
              stop(e);
              onEdit();
            },
            title: "Editar",
            "aria-label": "Editar lead",
          },
        ]
      : []),
    ...(lead.telefone && isMobile
      ? [
          {
            key: "whatsapp",
            variant: "green" as const,
            icon: <MessageCircle size={15} strokeWidth={2.2} />,
            onClick: (e: MouseEvent<HTMLButtonElement>) => {
              stop(e);
              window.open(`https://wa.me/55${lead.telefone!.replace(/\D/g, "")}`, "_blank");
            },
            title: "WhatsApp",
            "aria-label": "Abrir WhatsApp",
          },
        ]
      : []),
  ];

  return (
    <CrmKanbanEntityCard
      seed={lead.id}
      nome={lead.nome}
      codigo={codigo}
      subtitle={lead.agente_responsavel || undefined}
      preview={preview ? linhaUnica(preview, 120) : undefined}
      statusLabel="ATIVO"
      statusActive
      metrics={metrics}
      progressPct={lead.score}
      stageLabel={stageLabel || undefined}
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
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginRight: 8,
              padding: "3px 8px",
              borderRadius: 999,
              background: canal.ehTeste ? "rgba(148, 163, 184, 0.16)" : "rgba(37, 211, 102, 0.1)",
              color: origemCor,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.2,
            }}
            title={canal.ehTeste ? "Conversa de teste no Copiloto IA" : `Canal: ${origemLabel}`}
          >
            <OrigemIcon size={12} strokeWidth={2.2} aria-hidden />
            {canal.ehTeste ? "Interno · teste" : origemLabel}
          </span>
          <span style={{ color: CRM_KANBAN.muted, fontSize: 10, fontWeight: 600, marginRight: 4 }}>
            {tempo(lead.atualizado_em)}
          </span>
          {actionItems.length > 0 ? (
            <CrmIconButtonGroup items={actionItems} aria-label="Ações do lead" />
          ) : null}
        </>
      }
    />
  );
}
