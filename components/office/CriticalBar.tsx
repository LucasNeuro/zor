"use client";

import { DECISIONS_MOCK, REVENUE_AT_RISK } from "@/lib/data/decisions-mock";

interface CriticalBarProps {
  onVerInbox: () => void;
}

export default function CriticalBar({ onVerInbox }: CriticalBarProps) {
  const criticals = DECISIONS_MOCK.filter((d) => d.status === "critical");
  if (criticals.length === 0) return null;

  const topDecision = [...criticals].sort((a, b) => b.prioridade - a.prioridade)[0];
  const totalRisco = REVENUE_AT_RISK.total;

  return (
    <div style={{
      height: 44, padding: "0 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)",
      flexShrink: 0, gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: "#ef4444", boxShadow: "0 0 8px #ef4444",
          animation: "pulse 1.5s infinite",
        }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ color: "#ef4444" }}>
            {criticals.length} crítico{criticals.length > 1 ? "s" : ""}
          </strong>
          {" "}exigem ação —{" "}
          <strong>R${(totalRisco / 1000).toFixed(0)}k</strong>
          {" "}em risco — Próxima: {topDecision.titulo}
        </span>
      </div>
      <button
        onClick={onVerInbox}
        style={{
          padding: "6px 14px", borderRadius: 6, flexShrink: 0, whiteSpace: "nowrap",
          background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
          color: "#ef4444", fontSize: 11, cursor: "pointer", fontWeight: 700,
          transition: "all 150ms",
        }}
      >
        Ver o que precisa de mim →
      </button>
    </div>
  );
}
