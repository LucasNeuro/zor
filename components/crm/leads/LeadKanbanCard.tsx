"use client";

import type { CSSProperties, MouseEvent } from "react";
import { MessageCircle, Pencil } from "lucide-react";
import {
  AgenteSideoverEntityCard,
} from "@/components/crm/AgenteSideoverCards";
import {
  labelMercadoLead,
  mercadoAccent,
  mercadoIcon,
  mercadosExtrasLead,
  resolverMercadoLead,
} from "@/lib/crm/mercado-visual";

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
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

function borderUrgency(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 5) return "#22C55E";
  if (m < 15) return "#EAB308";
  return "#EF4444";
}

function truncar(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function linhaUnica(s: string, n: number) {
  return truncar(s.replace(/\s+/g, " "), n);
}

type Props = {
  lead: LeadKanbanCardData;
  dragging?: boolean;
  isMobile?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
};

const cardWrap: CSSProperties = {
  cursor: "pointer",
  opacity: 1,
  transition: "opacity 0.15s",
};

export function LeadKanbanCard({
  lead,
  dragging,
  isMobile,
  onOpen,
  onEdit,
  draggable,
  onDragStart,
  onDragEnd,
}: Props) {
  const mercado = resolverMercadoLead(lead.metadata);
  const accent = mercadoAccent(mercado);
  const Icon = mercadoIcon(mercado);
  const extras = mercadosExtrasLead(lead.metadata);
  const urgencia = borderUrgency(lead.atualizado_em);
  const local =
    [lead.pessoa_cidade, lead.pessoa_estado].filter(Boolean).join(" / ") || null;
  const preview =
    lead.ultima_mensagem_fila?.trim() ||
    lead.proxima_acao?.trim() ||
    null;
  const origemCor = ORIGENS_COLOR[lead.origem || ""] || "#6B7280";

  const codigos = [
    lead.codigo,
    lead._pessoa_codigo && lead.codigo !== lead._pessoa_codigo
      ? lead._pessoa_codigo
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const linhaSecundaria = [
    labelMercadoLead(lead.metadata),
    lead.agente_responsavel || null,
    extras.length > 0 ? `+${extras.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const metaPrincipal = lead.telefone || local || "Sem contato";
  const metaSecundaria =
    lead.score >= 70 ? `Score ${lead.score}` : lead._email_exibicao ? linhaUnica(lead._email_exibicao, 18) : `Score ${lead.score}`;

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
        ...cardWrap,
        opacity: dragging ? 0.5 : 1,
        borderLeft: `3px solid ${urgencia}`,
        borderRadius: 14,
      }}
    >
      <AgenteSideoverEntityCard
        accent={accent}
        Icon={Icon}
        fallbackProgress={Math.min(1, Math.max(0.08, (lead.score || 0) / 100))}
        pulse={Date.now() - new Date(lead.atualizado_em).getTime() < 300_000}
        avatarCaption={mercado}
        footer={
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {lead.origem ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: `${origemCor}18`,
                    color: origemCor,
                    border: `1px solid ${origemCor}44`,
                  }}
                >
                  {ORIGENS_LABEL[lead.origem] || lead.origem}
                </span>
              ) : null}
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                {tempo(lead.atualizado_em)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
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
              {lead.telefone && isMobile ? (
                <a
                  href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="WhatsApp"
                  onClick={stop}
                  style={{ ...actionBtn, background: "rgba(37, 211, 102, 0.12)" }}
                >
                  <MessageCircle size={14} strokeWidth={2.2} color="#25D366" />
                </a>
              ) : null}
            </div>
          </div>
        }
      >
        <div style={{ marginBottom: 6 }}>
          <strong
            style={{
              color: "#0b2210",
              fontSize: 13,
              letterSpacing: "-0.02em",
              display: "-webkit-box",
              lineHeight: 1.25,
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {lead.nome}
          </strong>
          <span
            style={{
              display: "block",
              marginTop: 2,
              color: "#5d7a67",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {linhaSecundaria}
          </span>
        </div>
        {codigos ? (
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 10,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(201, 162, 74, 0.92)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={codigos}
          >
            {codigos}
          </p>
        ) : null}
        {lead.valor_estimado > 0 ? (
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#22c55e" }}>
            {moeda(lead.valor_estimado)}
          </p>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 8,
            alignItems: "center",
            marginBottom: preview ? 8 : 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "#c8d4e6",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={metaPrincipal}
            >
              {metaPrincipal}
            </div>
            <div
              style={{
                color: lead.score >= 70 ? "#86efac" : "#94a3b8",
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={metaSecundaria}
            >
              {metaSecundaria}
            </div>
          </div>
          <span
            style={{
              borderRadius: 999,
              border: `1px solid ${accent}44`,
              background: `${accent}18`,
              color: accent,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {lead.score ?? 0}
          </span>
        </div>
        {preview ? (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(56, 74, 102, 0.38)",
              background: "rgba(9, 14, 22, 0.58)",
              padding: "7px 9px",
            }}
            title={preview}
          >
            <p
              style={{
                margin: 0,
                color: "#94a3b8",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Próxima ação
            </p>
            <p
              style={{
                margin: "3px 0 0",
                color: "#c8d4e6",
                fontSize: 11,
                lineHeight: 1.35,
                display: "-webkit-box",
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              }}
            >
              {linhaUnica(preview, 90)}
            </p>
          </div>
        ) : null}
      </AgenteSideoverEntityCard>
    </div>
  );
}

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
