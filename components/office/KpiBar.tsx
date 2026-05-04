"use client";

import { useState } from "react";

interface Kpi {
  label: string;
  valor: string;
  meta: string;
  status: "green" | "yellow" | "red";
  diagnostico: string;
  tendencia: string;
}

const KPIS: Kpi[] = [
  { label: "CPL Médio",    valor: "R$76",   meta: "R$60",  status: "yellow", diagnostico: "Meta: R$60 — CPL acima. ROAS de 4.1x compensa parcialmente.", tendencia: "↑12%" },
  { label: "Leads/dia",   valor: "62",      meta: "50",    status: "green",  diagnostico: "Acima da meta. Meta Ads 34 leads, Google 28 leads.", tendencia: "↑24%" },
  { label: "Taxa Qualif.", valor: "38%",    meta: "45%",   status: "yellow", diagnostico: "Abaixo da meta. Revisar qualidade do tráfego e segmentação.", tendencia: "↓3%" },
  { label: "Tempo Resp.",  valor: "8 min",  meta: "5 min", status: "red",    diagnostico: "Acima da meta. 3 leads aguardando contato no momento.", tendencia: "↑60%" },
  { label: "Match Rate",  valor: "87%",     meta: "90%",   status: "yellow", diagnostico: "Próximo da meta. 4 parceiros disponíveis para novos leads.", tendencia: "→0%" },
  { label: "NPS",         valor: "8.2",     meta: "8.0",   status: "green",  diagnostico: "Acima da meta. 2 clientes em atenção monitorados.", tendencia: "↑0.3" },
];

const STATUS_COLOR = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };

function tendenciaColor(t: string): string {
  if (t.startsWith("↑")) return "#22c55e";
  if (t.startsWith("↓")) return "#ef4444";
  return "#94a3b8";
}

export function KpiBar() {
  const [activeKpi, setActiveKpi] = useState<number | null>(null);

  return (
    <div style={{
      height: 44, display: "flex", alignItems: "stretch",
      background: "rgba(255,255,255,0.02)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      flexShrink: 0, overflow: "hidden",
    }}>
      {KPIS.map((kpi, i) => {
        const color = STATUS_COLOR[kpi.status];
        const isActive = activeKpi === i;
        return (
          <div key={kpi.label} style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
            <button
              onClick={() => setActiveKpi(isActive ? null : i)}
              style={{
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: "0 16px", width: "100%", cursor: "pointer",
                background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none", borderRight: i < KPIS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2, whiteSpace: "nowrap" }}>
                {kpi.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap" }}>{kpi.valor}</span>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: tendenciaColor(kpi.tendencia), fontWeight: 600 }}>{kpi.tendencia}</span>
              </div>

              {isActive && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
                  zIndex: 300, width: 230,
                  background: "#1e293b", border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8, padding: "10px 12px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{kpi.label} — {kpi.valor}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>meta: {kpi.meta}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{kpi.diagnostico}</p>
                </div>
              )}
            </button>

          </div>
        );
      })}
    </div>
  );
}
