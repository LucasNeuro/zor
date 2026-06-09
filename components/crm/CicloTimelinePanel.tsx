"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  CICLO_STATUS_COR,
  TIMELINE_KIND_ICON,
  acoesParaTextoFromTimeline,
  type CicloTimelineEvent,
  formatarDuracaoMs,
  tempoRelativoCiclo,
} from "@/lib/crm/ciclo-ui";
import {
  RF_ACCENT,
  RF_BG_PANEL,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type TimelineResponse = {
  ciclo?: { tipo?: string; nome?: string };
  eventos?: CicloTimelineEvent[];
  resumo?: { total: number; execucoes: number; acoes_ia: number; prompts: number };
  dica_vazia?: string | null;
  error?: string;
};

type Props = {
  cicloId: string;
  theme?: "dark" | "light";
  onRefreshRequest?: () => void;
};

function acoesLista(ev: CicloTimelineEvent): string[] {
  return acoesParaTextoFromTimeline(ev.acoes_tomadas);
}

export function CicloTimelinePanel({ cicloId, theme = "dark", onRefreshRequest }: Props) {
  const dark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventos, setEventos] = useState<CicloTimelineEvent[]>([]);
  const [resumo, setResumo] = useState<TimelineResponse["resumo"] | null>(null);
  const [dicaVazia, setDicaVazia] = useState<string | null>(null);
  const [cicloTipo, setCicloTipo] = useState<string>("");

  const carregar = useCallback(async () => {
    if (!cicloId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(cicloId)}/timeline?limit=50`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as TimelineResponse;
      if (!res.ok) throw new Error(json.error || "Falha ao carregar timeline.");
      setEventos(Array.isArray(json.eventos) ? json.eventos : []);
      setResumo(json.resumo ?? null);
      setDicaVazia(json.dica_vazia ?? null);
      setCicloTipo(String(json.ciclo?.tipo ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [cicloId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const muted = dark ? RF_TEXT_MUTED : "#5d7a67";
  const primary = dark ? RF_TEXT_PRIMARY : "#0b2210";
  const panelBg = dark ? RF_BG_PANEL : "#f8fcf6";
  const panelBorder = dark ? RF_BORDER_STRONG : "#d4ecd0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12, color: muted, lineHeight: 1.45, flex: "1 1 auto" }}>
          Histórico unificado: execuções em{" "}
          <code style={{ color: RF_ACCENT, fontSize: 11 }}>hub_ciclos_log</code>
          {cicloTipo === "gatilho" ? (
            <>
              , prompts e ações IA do agente
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => {
            void carregar();
            onRefreshRequest?.();
          }}
          disabled={loading}
          title="Atualizar timeline"
          aria-label="Atualizar timeline"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${panelBorder}`,
            background: dark ? "rgba(6, 13, 8, 0.6)" : "#ffffff",
            color: RF_ACCENT,
            fontSize: 11,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} strokeWidth={2.25} aria-hidden />
          Atualizar
        </button>
      </div>

      {resumo && resumo.total > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            { label: "Total", n: resumo.total },
            { label: "Execuções", n: resumo.execucoes },
            ...(resumo.acoes_ia > 0 ? [{ label: "Ações IA", n: resumo.acoes_ia }] : []),
            ...(resumo.prompts > 0 ? [{ label: "Prompts", n: resumo.prompts }] : []),
          ].map((chip) => (
            <span
              key={chip.label}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: dark ? "rgba(146, 255, 0, 0.1)" : "rgba(146, 255, 0, 0.14)",
                border: `1px solid ${dark ? "rgba(146, 255, 0, 0.25)" : "rgba(146, 255, 0, 0.4)"}`,
                color: dark ? RF_ACCENT : "#1a4d32",
              }}
            >
              {chip.label}: {chip.n}
            </span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: muted }}>Carregando histórico…</p>
      ) : error ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: dark ? "rgba(220, 38, 38, 0.08)" : "#fff2f1",
            color: "#dc2626",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : eventos.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: `1px solid ${panelBorder}`,
            background: panelBg,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, color: primary, fontWeight: 700 }}>
            Nenhum evento registado ainda
          </p>
          <p style={{ margin: 0, fontSize: 12, color: muted, lineHeight: 1.55 }}>
            {dicaVazia ||
              "Quando o ciclo executar, as entradas aparecem aqui em ordem cronológica."}
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 0 0 18px",
            borderLeft: `2px solid ${panelBorder}`,
          }}
        >
          {eventos.map((ev) => {
            const KindIcon = TIMELINE_KIND_ICON[ev.kind];
            const stCor = CICLO_STATUS_COR[ev.status] || "#6b8a76";
            const acoes = acoesLista(ev);
            const duracao = formatarDuracaoMs(ev.iniciado_em, ev.finalizado_em ?? undefined);

            return (
              <li key={ev.id} style={{ position: "relative", paddingBottom: 14 }}>
                <span
                  style={{
                    position: "absolute",
                    left: -25,
                    top: 6,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: stCor,
                    boxShadow: `0 0 0 3px ${dark ? "rgba(6, 13, 8, 0.9)" : "#ffffff"}`,
                  }}
                />
                <div
                  style={{
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: panelBg,
                    border: `1px solid ${panelBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: dark ? "rgba(146, 255, 0, 0.1)" : "rgba(146, 255, 0, 0.16)",
                        border: `1px solid ${dark ? "rgba(146, 255, 0, 0.2)" : "rgba(146, 255, 0, 0.35)"}`,
                      }}
                    >
                      <KindIcon size={16} strokeWidth={2.25} color={RF_ACCENT} aria-hidden />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: primary }}>{ev.titulo}</span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: `${stCor}22`,
                            color: stCor,
                            textTransform: "capitalize",
                          }}
                        >
                          {ev.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {ev.subtitulo ? (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: RF_TEXT_SECONDARY }}>{ev.subtitulo}</p>
                      ) : null}
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: muted }}>
                        {tempoRelativoCiclo(ev.iniciado_em)}
                        {duracao ? ` · ${duracao}` : ""}
                        {ev.tokens_usados != null && ev.tokens_usados > 0
                          ? ` · ${ev.tokens_usados} tokens`
                          : ""}
                        {ev.custo_brl != null && ev.custo_brl > 0
                          ? ` · R$ ${Number(ev.custo_brl).toFixed(4)}`
                          : ""}
                      </p>
                      {ev.erro ? (
                        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#dc2626" }}>{ev.erro}</p>
                      ) : null}
                      {acoes.length > 0 ? (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11, color: muted }}>
                          {acoes.map((a, i) => (
                            <li key={i} style={{ marginBottom: 2 }}>
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
