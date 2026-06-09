"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  Download,
  Filter,
  MapPin,
  MessageCircle,
  Settings2,
  Sparkles,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  exportarTimelineCsv,
  filtrarTimelinePorCategoria,
  LEAD_TIMELINE_CATEGORY_LABELS,
  type LeadTimelineCategory,
  type LeadTimelineEvent,
} from "@/lib/crm/lead-timeline";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";

type Theme = "light" | "dark";

type Props = {
  events: LeadTimelineEvent[];
  loading?: boolean;
  theme?: Theme;
  compact?: boolean;
  leadNome?: string;
  className?: string;
};

const FILTER_OPTIONS: { id: LeadTimelineCategory | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "estagio", label: "Estágio" },
  { id: "transferencia", label: "Transferências" },
  { id: "conversa_ia", label: "IA" },
  { id: "conversa_humano", label: "Humano" },
  { id: "sistema", label: "Sistema" },
];

const CATEGORY_ICON: Record<LeadTimelineCategory, LucideIcon> = {
  estagio: MapPin,
  transferencia: ArrowRightLeft,
  conversa_ia: Sparkles,
  conversa_humano: MessageCircle,
  sistema: Settings2,
  outro: Bot,
};

const CATEGORY_COLOR: Record<LeadTimelineCategory, string> = {
  estagio: "#3b82f6",
  transferencia: "#8b5cf6",
  conversa_ia: "#c9a24a",
  conversa_humano: "#10b981",
  sistema: "#6b7280",
  outro: "#94a3b8",
};

function tempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function themeTokens(theme: Theme) {
  if (theme === "dark") {
    return {
      panelBg: "#0a1018",
      cardBg: "rgba(10, 16, 24, 0.88)",
      cardBgHighlight: "rgba(16, 24, 36, 0.85)",
      border: "rgba(48, 54, 61, 0.38)",
      text: "#e5e7eb",
      textMuted: "#5c6570",
      textSub: "#7d8a99",
      track: "rgba(146, 255, 0, 0.12)",
      headerBg: "rgba(5, 8, 14, 0.92)",
      chipBg: "rgba(18, 56, 43, 0.2)",
      chipActiveBg: "rgba(146, 255, 0, 0.12)",
      chipColor: "#92ff00",
      chipInactive: "#6b8a76",
      btnBorder: "rgba(48, 54, 61, 0.38)",
    };
  }
  return {
    panelBg: "#f8fcf6",
    cardBg: "#ffffff",
    cardBgHighlight: "#f8fcf6",
    border: "rgba(18, 56, 43, 0.12)",
    text: "#0b2210",
    textMuted: "#6b8a76",
    textSub: "#3d5c48",
    track: "rgba(18, 56, 43, 0.08)",
    headerBg: "#ffffff",
    chipBg: "#ffffff",
    chipActiveBg: "#ecffd8",
    chipColor: CRM_ACCENT,
    chipInactive: "#5d7a67",
    btnBorder: "#d4ecd0",
  };
}

export function LeadActivityFlow({
  events,
  loading = false,
  theme = "light",
  compact = false,
  leadNome,
  className = "",
}: Props) {
  const [filtro, setFiltro] = useState<LeadTimelineCategory | "todos">("todos");
  const [showFiltros, setShowFiltros] = useState(false);
  const t = themeTokens(theme);

  const filtrados = useMemo(
    () => filtrarTimelinePorCategoria(events, filtro),
    [events, filtro]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: events.length };
    for (const ev of events) {
      c[ev.categoria] = (c[ev.categoria] ?? 0) + 1;
    }
    return c;
  }, [events]);

  return (
    <div
      className={className}
      style={{
        background: t.panelBg,
        borderRadius: compact ? 0 : 16,
        border: compact ? "none" : `1px solid ${t.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: compact ? "0 0 12px" : "14px 16px",
          borderBottom: compact ? `1px solid ${t.border}` : `1px solid ${t.border}`,
          background: t.headerBg,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: compact ? 12 : 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: t.textMuted,
            }}
          >
            Fluxo de Atividade Recente
          </h3>
          {!compact ? (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: t.textSub, lineHeight: 1.45 }}>
              Estágios, transferências, conversas e ações do sistema
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowFiltros((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 10,
              border: `1px solid ${t.btnBorder}`,
              background: showFiltros ? t.chipActiveBg : t.chipBg,
              color: t.chipColor,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
            aria-expanded={showFiltros}
          >
            <Filter size={13} />
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => exportarTimelineCsv(filtrados, leadNome)}
            disabled={filtrados.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 10,
              border: `1px solid ${t.btnBorder}`,
              background: t.chipBg,
              color: filtrados.length === 0 ? t.textMuted : t.chipColor,
              fontSize: 11,
              fontWeight: 700,
              cursor: filtrados.length === 0 ? "not-allowed" : "pointer",
              opacity: filtrados.length === 0 ? 0.55 : 1,
            }}
          >
            <Download size={13} />
            Exportar
          </button>
        </div>
      </div>

      {showFiltros ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "10px 16px",
            borderBottom: `1px solid ${t.border}`,
            background: theme === "light" ? "#eef7eb" : "rgba(5, 8, 14, 0.65)",
          }}
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filtro === opt.id;
            const count = counts[opt.id] ?? 0;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFiltro(opt.id)}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? t.chipColor : t.btnBorder}`,
                  background: active ? t.chipActiveBg : t.chipBg,
                  color: active ? t.chipColor : t.chipInactive,
                  cursor: "pointer",
                }}
              >
                {opt.label}
                {count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      <div style={{ padding: compact ? "12px 0 0" : "16px" }}>
        {loading ? (
          <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: t.textMuted, padding: "24px 0" }}>
            A carregar linha do tempo…
          </p>
        ) : filtrados.length === 0 ? (
          <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: t.textMuted, padding: "28px 12px" }}>
            {events.length === 0
              ? "Nenhuma atividade registada ainda. Mudanças de estágio, mensagens e encaminhamentos aparecem aqui."
              : "Nenhum evento neste filtro."}
          </p>
        ) : (
          <div style={{ position: "relative", maxWidth: compact ? "100%" : 720, margin: "0 auto" }}>
            <div
              style={{
                position: "absolute",
                left: 15,
                top: 8,
                bottom: 0,
                width: 1,
                background: `linear-gradient(180deg, ${t.track}, transparent)`,
              }}
              aria-hidden
            />
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filtrados.map((ev, idx) => {
                const Icon = CATEGORY_ICON[ev.categoria];
                const cor = CATEGORY_COLOR[ev.categoria];
                const isIa = ev.autorTipo === "ia";

                return (
                  <li
                    key={`${ev.fonte}-${ev.id}`}
                    style={{
                      position: "relative",
                      display: "flex",
                      gap: 14,
                      paddingBottom: idx < filtrados.length - 1 ? 20 : 0,
                      paddingLeft: 40,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 2,
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        border: `1px solid ${isIa ? `${cor}66` : t.border}`,
                        background: isIa ? `${cor}18` : t.cardBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: theme === "light" ? "0 0 0 4px #f8fcf6" : "0 0 0 4px rgba(5,8,14,0.9)",
                      }}
                    >
                      {isIa ? (
                        <Sparkles size={14} style={{ color: cor }} />
                      ) : ev.autorTipo === "cliente" ? (
                        <User size={14} style={{ color: t.textMuted }} />
                      ) : (
                        <Icon size={14} style={{ color: cor }} />
                      )}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: 12,
                        border: `1px solid ${t.border}`,
                        background: idx === 0 ? t.cardBgHighlight : t.cardBg,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            color: cor,
                          }}
                        >
                          {LEAD_TIMELINE_CATEGORY_LABELS[ev.categoria]}
                        </span>
                        <time
                          style={{ fontSize: 10, color: t.textMuted, fontVariantNumeric: "tabular-nums" }}
                          dateTime={ev.criado_em}
                        >
                          {formatarDataHora(ev.criado_em)}
                        </time>
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: t.text,
                          fontWeight: idx === 0 ? 600 : 500,
                        }}
                      >
                        {ev.descricao}
                      </p>
                      <p style={{ margin: "8px 0 0", fontSize: 11, color: t.textMuted }}>
                        <span style={{ color: t.textSub }}>{ev.autor}</span>
                        {" · "}
                        {tempoRelativo(ev.criado_em)}
                        {ev.autorTipo === "ia" ? (
                          <span style={{ color: cor, fontWeight: 700, marginLeft: 6 }}>IA</span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
