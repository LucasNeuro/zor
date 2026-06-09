"use client";

import type { CSSProperties } from "react";
import { calcularSaudeAgente, SAUDE_CORES } from "@/lib/agente-saude";
import { cargaOperacionalVisual } from "@/lib/crm/agente-avatar-gen";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import { CRM_BORDER_SOFT, CRM_SURFACE_CARD } from "@/lib/crm-shell-theme";

type OperacaoPayload = {
  ciclos: Record<string, unknown>[];
  execucoes_ciclo: Record<string, unknown>[];
  acoes: Record<string, unknown>[];
  ultimo_prompt_em: string | null;
};

export type AgentePerformancePanelProps = {
  agenteSlug: string;
  ativo: boolean;
  arquivado: boolean;
  operacao: OperacaoPayload | null;
  operacaoLoading: boolean;
};

function tempoRelativo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

const LIGHT_CARD: CSSProperties = {
  background: CRM_SURFACE_CARD,
  border: "1px solid rgba(18, 56, 43, 0.12)",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15, 56, 39, 0.06)",
};

export function AgentePerformancePanel({
  agenteSlug,
  ativo,
  arquivado,
  operacao,
  operacaoLoading,
}: AgentePerformancePanelProps) {
  const ciclosAtivos = (operacao?.ciclos || []).filter((c) => (c as { ativo?: boolean }).ativo !== false).length;
  const logs = (operacao?.execucoes_ciclo || []).map((l) => ({
    status: (l as { status?: string }).status,
    iniciado_em: (l as { iniciado_em?: string }).iniciado_em,
  }));
  const saude = operacao
    ? calcularSaudeAgente({
        ativoOperacional: ativo,
        arquivado,
        ciclosAtivosCount: ciclosAtivos,
        logsCiclo: logs,
        ultimoPromptEm: operacao.ultimo_prompt_em,
      })
    : null;
  const cargaPct = Math.round(cargaOperacionalVisual(agenteSlug, ativo && !arquivado) * 100);
  const acoesRecentes = operacao?.acoes?.length ?? 0;
  const ultimoPrompt = tempoRelativo(operacao?.ultimo_prompt_em);

  return (
    <div
      style={{
        ...LIGHT_CARD,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: "#6b8a76",
            textTransform: "uppercase",
          }}
        >
          Performance operacional
        </h3>
        {operacaoLoading ? (
          <p style={{ margin: 0, fontSize: 12, color: "#6b8a76", flex: 1 }}>A carregar métricas…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flex: 1 }}>
            {[
              { label: "CICLOS ATIVOS", value: String(ciclosAtivos), color: BRAND_GREEN_BRIGHT },
              { label: "AÇÕES RECENTES", value: String(acoesRecentes), color: CRM_ACCENT },
            ].map((tile) => (
              <div
                key={tile.label}
                style={{
                  background: "rgba(18, 56, 43, 0.04)",
                  border: `1px solid ${CRM_BORDER_SOFT}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: "#6b8a76" }}>
                  {tile.label}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: tile.color, lineHeight: 1 }}>
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_TEXT_DARK }}>Carga neural</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: BRAND_GREEN_BRIGHT }}>{cargaPct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(18, 56, 43, 0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${cargaPct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${CRM_ACCENT} 0%, ${BRAND_GREEN_BRIGHT} 100%)`,
              }}
            />
          </div>
        </div>
        {saude ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#5d7a67", lineHeight: 1.5 }}>
            Saúde:{" "}
            <strong
              style={{
                color: SAUDE_CORES[saude].fg,
                background: SAUDE_CORES[saude].bg,
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              {SAUDE_CORES[saude].label}
            </strong>
            {ultimoPrompt ? ` · última resposta IA há ${ultimoPrompt}` : null}
          </p>
        ) : null}
    </div>
  );
}
