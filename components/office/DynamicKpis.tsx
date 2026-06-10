"use client";

import Link from "next/link";
import { type Metricas } from "@/hooks/useMetricas";

interface DynamicKpisProps {
  metricas: Metricas;
  onNavegar?: (href: string) => void;
}

export function DynamicKpis({ metricas, onNavegar }: DynamicKpisProps) {
  const kpis = [
    {
      label: "Aguardando você",
      value: metricas.loading ? "—" : metricas.leadsAguardando,
      cor: metricas.leadsAguardando > 0 ? "#c9a24a" : "#34d399",
      href: "/crm/leads",
    },
    {
      label: "Aprovações",
      value: metricas.loading ? "—" : metricas.aprovacoesPendentes,
      cor: metricas.aprovacoesPendentes > 0 ? "#ef4444" : "#34d399",
      href: "/crm/aprovacoes",
    },
    {
      label: "Conversas ativas",
      value: metricas.loading ? "—" : metricas.mensagensFilaPendentes,
      cor: "#34d399",
      href: "/crm/leads",
    },
  ];

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
      style={{ background: "var(--obra-dark, #0d1117)", borderColor: "var(--obra-borda, #30363d)" }}
    >
      {kpis.map(kpi => (
        <button
          key={kpi.label}
          onClick={() => onNavegar ? onNavegar(kpi.href) : undefined}
          className="flex items-center gap-3 rounded-lg px-3 py-1.5 transition-colors"
          style={{
            background: "var(--obra-dark-2, #161b22)",
            border: `1px solid ${kpi.cor}30`,
            cursor: "pointer",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: kpi.cor, flexShrink: 0 }} />
          <div>
            <div style={{ color: "var(--obra-texto-2, #8b949e)", fontSize: 10, lineHeight: 1.2 }}>{kpi.label}</div>
            <div style={{ color: kpi.cor, fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{kpi.value}</div>
          </div>
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <Link
        href="/crm"
        style={{ fontSize: 11, color: "var(--obra-texto-2, #8b949e)", textDecoration: "none", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--obra-borda, #30363d)" }}
      >
        Dashboard →
      </Link>
    </div>
  );
}
