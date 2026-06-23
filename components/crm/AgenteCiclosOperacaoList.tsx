"use client";

import { Clock, Webhook, Zap } from "lucide-react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  AgenteSideoverEntityCard,
  type AgenteCardTheme,
} from "@/components/crm/AgenteSideoverCards";
import { RF_BORDER, RF_TEXT_MUTED, RF_TEXT_PRIMARY, RF_TEXT_SECONDARY } from "@/lib/crm/crm-retrofit-dark-theme";

export type CicloOperacaoRow = {
  id?: string;
  nome?: string;
  descricao?: string;
  ativo?: boolean;
  ultimo_status?: string;
  tipo?: string;
  ultimo_ciclo?: string | null;
  cron_expressao?: string | null;
  intervalo_minutos?: number | null;
  total_execucoes?: number | null;
};

const TIPO_CICLO_OPERACAO: Record<string, { cor: string }> = {
  continuo: { cor: "#22c55e" },
  programado: { cor: BRAND_GREEN_BRIGHT },
  gatilho: { cor: "#3b82f6" },
};

const LIGHT_TEXT = {
  primary: BRAND_TEXT_DARK,
  secondary: "#2d4a38",
  muted: "#4a6356",
  dim: "#5d7a67",
  border: "rgba(18, 56, 43, 0.1)",
};

const DARK_TEXT = {
  primary: RF_TEXT_PRIMARY,
  secondary: RF_TEXT_SECONDARY,
  muted: RF_TEXT_MUTED,
  dim: "#5d7a67",
  border: RF_BORDER,
};

function corUltimoCicloStatus(st?: string, theme: AgenteCardTheme = "dark"): string {
  const s = String(st || "").toLowerCase();
  if (s === "sucesso") return theme === "light" ? "#15803d" : "#86efac";
  if (s === "erro") return theme === "light" ? "#dc2626" : "#f87171";
  if (s === "rodando") return theme === "light" ? "#ca8a04" : "#fbbf24";
  if (s === "sem_acao") return theme === "light" ? LIGHT_TEXT.muted : "#6b8a76";
  return theme === "light" ? LIGHT_TEXT.muted : "#6b8a76";
}

function estimateIntervalMinutes(cron?: string | null, intervaloRaw?: unknown): number | null {
  const fromNum =
    typeof intervaloRaw === "number"
      ? intervaloRaw
      : typeof intervaloRaw === "string"
        ? Number.parseFloat(intervaloRaw)
        : NaN;
  if (Number.isFinite(fromNum) && fromNum > 0) return fromNum;

  const c = String(cron || "").trim();
  if (!c) return null;
  if (c === "*/2 * * * *") return 2;
  if (c === "*/30 * * * *") return 30;
  if (c === "0 */6 * * *") return 360;
  if (/^0 \d+ \* \* \*$/.test(c)) return 1440;
  return null;
}

function progressoAnelCiclo(ultimoIso: string | null | undefined, intervalMin: number | null): number {
  if (!intervalMin || intervalMin <= 0) return 0;
  const t = ultimoIso ? new Date(ultimoIso).getTime() : NaN;
  if (Number.isNaN(t)) return 0;
  const elapsed = Date.now() - t;
  const period = intervalMin * 60000;
  if (period <= 0) return 0;
  const p = (elapsed % period) / period;
  return Math.min(1, Math.max(0, p));
}

function rotuloCadenciaCron(intervalMin: number | null, cron?: string | null, tipo?: string): string {
  if (intervalMin != null && intervalMin > 0) {
    if (intervalMin < 60) return `a cada ${Math.round(intervalMin)} min`;
    if (intervalMin < 1440) return `a cada ${Math.round(intervalMin / 60)} h`;
    return "≈ 1× ao dia";
  }
  const t = String(tipo || "").toLowerCase();
  if (t === "continuo") return "Contínuo (tempo real)";
  if (t === "programado") return "Programado (cron)";
  if (t === "gatilho") return "Sob gatilho";
  const cr = String(cron || "").trim();
  if (cr) return cr.length > 28 ? `${cr.slice(0, 28)}…` : cr;
  return t || "—";
}

function cicloTipoLabel(tipoKey: string): string {
  const t = String(tipoKey || "").toLowerCase();
  if (t === "programado") return "Programado";
  if (t === "gatilho") return "Gatilho";
  if (t === "continuo") return "Contínuo";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Ciclo";
}

function cicloRingIcon(tipoKey: string) {
  const t = String(tipoKey || "").toLowerCase();
  if (t === "gatilho") return Webhook;
  if (t === "continuo") return Zap;
  return Clock;
}

function formatarData(v?: string) {
  if (!v) return "Sem data";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tempoOpRelativo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = (Date.now() - d) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}

type Props = {
  ciclos: CicloOperacaoRow[];
  emptyMessage?: string;
  theme?: AgenteCardTheme;
  /** Oculta descrição técnica do ciclo (ex.: webhook) na ficha do agente. */
  mostrarDescricao?: boolean;
};

/** Tema claro (`light`) só na ficha `/crm/agentes/[slug]`; sideovers mantêm `dark` por defeito. */
export function AgenteCiclosOperacaoList({
  ciclos,
  emptyMessage = "Nenhum ciclo vinculado a este modelo.",
  theme = "dark",
  mostrarDescricao = true,
}: Props) {
  const txt = theme === "light" ? LIGHT_TEXT : DARK_TEXT;

  if (ciclos.length === 0) {
    return <p style={{ margin: 0, color: txt.muted, fontSize: 12, fontWeight: 500 }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ciclos.map((row) => {
        const tipoKey = String(row.tipo || "").toLowerCase();
        const metaTipo = TIPO_CICLO_OPERACAO[tipoKey] || { cor: "#5d7a67" };
        const intervalMin = estimateIntervalMinutes(row.cron_expressao, row.intervalo_minutos);
        const prog = progressoAnelCiclo(row.ultimo_ciclo, intervalMin);
        const ultimoIso = row.ultimo_ciclo ? String(row.ultimo_ciclo) : "";
        const execN = row.total_execucoes != null ? Number(row.total_execucoes) : null;
        const temExecucao =
          (ultimoIso && !Number.isNaN(new Date(ultimoIso).getTime())) ||
          (execN != null && execN > 0);
        const st = String(row.ultimo_status || "nunca_executado");
        const stCor = corUltimoCicloStatus(st, theme);
        const cadencia = rotuloCadenciaCron(intervalMin, row.cron_expressao, row.tipo);

        const labelTimer =
          row.ativo === false
            ? "Pausado"
            : !temExecucao
              ? "Aguardando 1ª exec."
              : intervalMin != null
                ? `${Math.round(prog * 100)}% período`
                : "Ativo";

        const ativoBadge =
          row.ativo !== false
            ? {
                bg: "rgba(146, 255, 0, 0.16)",
                color: theme === "light" ? "#1a5c32" : "#86efac",
                border: "rgba(146, 255, 0, 0.4)",
              }
            : {
                bg: theme === "light" ? "#fff2f1" : "#3f1515",
                color: theme === "light" ? "#dc2626" : "#fca5a5",
                border: theme === "light" ? "#fecaca" : "#7f1d1d",
              };

        return (
          <AgenteSideoverEntityCard
            key={String(row.id || row.nome)}
            theme={theme}
            accent={metaTipo.cor}
            progress={prog}
            fallbackProgress={tipoKey === "gatilho" ? 0.22 : tipoKey === "continuo" ? 0.2 : 0.28}
            Icon={cicloRingIcon(tipoKey)}
            dim={row.ativo === false}
            pulse={!temExecucao && row.ativo !== false}
            avatarCaption={labelTimer}
            footer={
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: metaTipo.cor,
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: `${metaTipo.cor}14`,
                        border: `1px solid ${metaTipo.cor}33`,
                      }}
                    >
                      {tipoKey === "gatilho" ? (
                        <Webhook size={11} strokeWidth={2.2} aria-hidden />
                      ) : tipoKey === "continuo" ? (
                        <Zap size={11} strokeWidth={2.2} aria-hidden />
                      ) : (
                        <Clock size={11} strokeWidth={2.2} aria-hidden />
                      )}
                      {cicloTipoLabel(tipoKey)}
                    </span>
                    <span style={{ color: txt.dim, fontSize: 10, fontWeight: 600 }}>·</span>
                    <span style={{ color: txt.secondary, fontSize: 10, fontWeight: 600 }}>{cadencia}</span>
                  </div>
                  <span style={{ color: txt.muted, fontSize: 10, fontWeight: 700 }}>{labelTimer}</span>
                </div>
                {mostrarDescricao && row.descricao && String(row.descricao).trim() ? (
                  <p
                    style={{
                      width: "100%",
                      margin: "10px 0 0",
                      fontSize: 11,
                      color: txt.muted,
                      lineHeight: 1.45,
                      borderTop: `1px solid ${txt.border}`,
                      paddingTop: 10,
                    }}
                  >
                    {String(row.descricao).trim().slice(0, 140)}
                    {String(row.descricao).trim().length > 140 ? "…" : ""}
                  </p>
                ) : null}
              </>
            }
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <strong style={{ color: txt.primary, fontSize: 14, letterSpacing: "-0.02em" }}>
                {String(row.nome || "—")}
              </strong>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: ativoBadge.bg,
                  color: ativoBadge.color,
                  border: `1px solid ${ativoBadge.border}`,
                }}
              >
                {row.ativo !== false ? "ativo" : "inativo"}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: `${stCor}18`,
                  color: stCor,
                  border: `1px solid ${stCor}44`,
                }}
              >
                Último status · {st.replace(/_/g, " ")}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "6px 16px",
                fontSize: 11,
                color: txt.muted,
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: txt.secondary, fontWeight: 700 }}>Última execução</span>
              <span style={{ color: temExecucao ? txt.secondary : txt.muted, fontWeight: temExecucao ? 600 : 500 }}>
                {temExecucao ? (
                  <>
                    <time dateTime={ultimoIso} style={{ color: txt.primary, fontWeight: 700 }}>
                      {formatarData(ultimoIso)}
                    </time>
                    <span style={{ color: txt.muted }}> ({tempoOpRelativo(ultimoIso)} atrás)</span>
                  </>
                ) : execN != null && execN > 0 ? (
                  `${execN} execução(ões) — sem data da última corrida`
                ) : (
                  "Nunca executado — aguardando 1ª corrida"
                )}
              </span>
              <span style={{ color: txt.secondary, fontWeight: 700 }}>Cadência</span>
              <span style={{ color: txt.secondary, fontWeight: 600 }}>{cadencia}</span>
              {execN != null && Number.isFinite(execN) ? (
                <>
                  <span style={{ color: txt.secondary, fontWeight: 700 }}>Total exec.</span>
                  <span style={{ color: txt.primary, fontWeight: 700 }}>{execN}</span>
                </>
              ) : null}
            </div>
          </AgenteSideoverEntityCard>
        );
      })}
    </div>
  );
}
