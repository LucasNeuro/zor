"use client";

import { RefreshCw, Send, Timer, Zap } from "lucide-react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import { CRM_BORDER_SOFT, CRM_SURFACE_CARD } from "@/lib/crm-shell-theme";
import type { FollowupOperacaoSnapshot, FollowupTimelineEvento } from "@/lib/hub/followup-operacao";

export type AgenteFollowupTimelineProps = {
  followup: FollowupOperacaoSnapshot | null | undefined;
  loading?: boolean;
  atualizadoEm?: number | null;
};

function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h atrás`;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function corStatus(status: FollowupTimelineEvento["status"]): { bg: string; fg: string; border: string } {
  switch (status) {
    case "sucesso":
      return { bg: "rgba(34, 197, 94, 0.12)", fg: "#15803d", border: "rgba(34, 197, 94, 0.35)" };
    case "erro":
      return { bg: "rgba(239, 68, 68, 0.1)", fg: "#dc2626", border: "rgba(239, 68, 68, 0.35)" };
    case "aguardando":
      return { bg: "rgba(234, 179, 8, 0.12)", fg: "#a16207", border: "rgba(234, 179, 8, 0.35)" };
    default:
      return { bg: "rgba(18, 56, 43, 0.05)", fg: "#4a6356", border: CRM_BORDER_SOFT };
  }
}

function IconeEvento({ tipo }: { tipo: FollowupTimelineEvento["tipo"] }) {
  const size = 14;
  if (tipo === "envio") return <Send size={size} />;
  return <Timer size={size} />;
}

export function AgenteFollowupTimeline({ followup, loading, atualizadoEm }: AgenteFollowupTimelineProps) {
  const elegiveis = followup?.estado_atual?.leads_elegiveis ?? 0;
  const envios24h = followup?.envios_24h ?? 0;
  const timeline = followup?.timeline ?? [];

  return (
    <div
      style={{
        background: CRM_SURFACE_CARD,
        border: "1px solid rgba(18, 56, 43, 0.12)",
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 8px 24px rgba(15, 56, 39, 0.06)",
        gridColumn: "1 / -1",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: "#6b8a76",
              textTransform: "uppercase",
            }}
          >
            Follow-ups em tempo real
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5d7a67", lineHeight: 1.45 }}>
            {followup?.ativo
              ? followup.resumo_cadencia ?? "Follow-up activo"
              : "Follow-up automático inactivo — active em Integrações."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#6b8a76" }}>
              <RefreshCw size={12} />
              A actualizar…
            </span>
          ) : atualizadoEm ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b8a76" }}>
              Actualizado {tempoRelativo(new Date(atualizadoEm).toISOString())}
            </span>
          ) : null}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(146, 255, 0, 0.1)",
              border: "1px solid rgba(146, 255, 0, 0.35)",
              fontSize: 10,
              fontWeight: 800,
              color: "#1a5c32",
            }}
          >
            <Zap size={11} />
            Live · 15s
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Leads elegíveis", value: String(elegiveis), color: CRM_ACCENT },
          { label: "Envios (24h)", value: String(envios24h), color: BRAND_GREEN_BRIGHT },
          {
            label: "Último tick",
            value: followup?.ultimo_tick_em ? tempoRelativo(followup.ultimo_tick_em) : "—",
            color: BRAND_TEXT_DARK,
          },
        ].map((tile) => (
          <div
            key={tile.label}
            style={{
              background: "rgba(18, 56, 43, 0.04)",
              border: `1px solid ${CRM_BORDER_SOFT}`,
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: "#6b8a76" }}>
              {tile.label}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: tile.color, lineHeight: 1.1 }}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {loading && timeline.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#6b8a76" }}>A carregar timeline…</p>
      ) : timeline.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#6b8a76", lineHeight: 1.5 }}>
          Nenhum follow-up registado ainda. Quando o cron ou worker rodar, os ticks aparecem aqui automaticamente.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {timeline.map((ev) => {
            const cores = corStatus(ev.status);
            return (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${cores.border}`,
                  background: cores.bg,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.65)",
                    color: cores.fg,
                    flexShrink: 0,
                  }}
                >
                  <IconeEvento tipo={ev.tipo} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: BRAND_TEXT_DARK }}>{ev.titulo}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#6b8a76", whiteSpace: "nowrap" }}>
                      {ev.status === "aguardando" ? "pendente" : tempoRelativo(ev.em)}
                    </span>
                  </div>
                  {ev.lead_nome ? (
                    <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: "#4a6356" }}>
                      Lead: {ev.lead_nome}
                    </p>
                  ) : null}
                  {ev.detalhe ? (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5d7a67", lineHeight: 1.45 }}>{ev.detalhe}</p>
                  ) : null}
                  {ev.fonte ? (
                    <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: "#6b8a76", textTransform: "uppercase" }}>
                      via {ev.fonte}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
