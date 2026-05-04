"use client";

import { DECISIONS_MOCK, REVENUE_AT_RISK } from "@/lib/data/decisions-mock";

interface MobileCriticalBarProps {
  onVerInbox: () => void;
}

export default function MobileCriticalBar({ onVerInbox }: MobileCriticalBarProps) {
  const criticals = DECISIONS_MOCK.filter((d) => d.status === "critical");
  if (criticals.length === 0) return null;

  return (
    <div
      onClick={onVerInbox}
      style={{
        margin: "8px 16px",
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#ef4444", boxShadow: "0 0 8px #ef4444",
          animation: "pulse 1.5s infinite", flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
            {criticals.length} decisões críticas
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
            R${(REVENUE_AT_RISK.total / 1000).toFixed(0)}k em risco
          </div>
        </div>
      </div>
      <span style={{ fontSize: 16, color: "#ef4444" }}>→</span>
    </div>
  );
}
