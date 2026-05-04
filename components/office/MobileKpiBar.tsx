"use client";

import { useState } from "react";

const KPIS = [
  { label: "CPL Médio",    valor: "R$76",  meta: "R$60",  status: "yellow" as const, tendencia: "↑12%", diagnostico: "Acima da meta. ROAS ainda saudável." },
  { label: "Leads/dia",   valor: "62",     meta: "50",    status: "green"  as const, tendencia: "↑24%", diagnostico: "Acima da meta. Meta Ads 34, Google 28." },
  { label: "Qualificação", valor: "38%",   meta: "45%",   status: "yellow" as const, tendencia: "↓3%",  diagnostico: "Abaixo da meta. Revisar qualidade do tráfego." },
  { label: "Resp. Lead",  valor: "8 min",  meta: "5 min", status: "red"    as const, tendencia: "↑60%", diagnostico: "Crítico. 3 leads aguardando contato." },
  { label: "Match Rate",  valor: "87%",    meta: "90%",   status: "yellow" as const, tendencia: "→0%",  diagnostico: "Próximo da meta. 4 parceiros disponíveis." },
  { label: "NPS",         valor: "8.2",    meta: "8.0",   status: "green"  as const, tendencia: "↑0.3", diagnostico: "Acima da meta. 2 clientes em atenção." },
];

const STATUS_COLORS = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };

export default function MobileKpiBar() {
  const [expandedKpi, setExpandedKpi] = useState<number | null>(null);

  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {KPIS.map((kpi, i) => {
          const color = STATUS_COLORS[kpi.status];
          const isExp = expandedKpi === i;
          return (
            <div
              key={i}
              onClick={() => setExpandedKpi(isExp ? null : i)}
              style={{
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                background: isExp ? `${color}15` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isExp ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                transition: "all 150ms",
              }}
            >
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
                {kpi.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{kpi.valor}</span>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 8, color, fontWeight: 600 }}>{kpi.tendencia} vs ontem</div>
            </div>
          );
        })}
      </div>

      {expandedKpi !== null && (
        <div style={{
          marginTop: 8, padding: "8px 10px", borderRadius: 7,
          background: `${STATUS_COLORS[KPIS[expandedKpi].status]}10`,
          border: `1px solid ${STATUS_COLORS[KPIS[expandedKpi].status]}30`,
        }}>
          <div style={{ fontSize: 10, color: STATUS_COLORS[KPIS[expandedKpi].status], fontWeight: 600, marginBottom: 3 }}>
            {KPIS[expandedKpi].label} — Meta: {KPIS[expandedKpi].meta}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
            {KPIS[expandedKpi].diagnostico}
          </div>
        </div>
      )}
    </div>
  );
}
