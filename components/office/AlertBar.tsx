"use client";

import { Alert } from "@/lib/alerts-system";

export function AlertBar({ criticals, onResolve }: { criticals: Alert[]; onResolve: (id: string) => void }) {
  if (criticals.length === 0) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "0 16px", height: 36, flexShrink: 0,
      background: "rgba(239,68,68,0.08)",
      borderBottom: "1px solid rgba(239,68,68,0.2)",
      overflowX: "auto",
    }}>
      <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
        🔴 {criticals.length} CRÍTICO{criticals.length > 1 ? "S" : ""}
      </span>
      <div style={{ width: 1, height: 16, background: "rgba(239,68,68,0.3)", flexShrink: 0 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {criticals.map((alert) => (
          <div key={alert.id} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>
              {alert.titulo}
            </span>
            {alert.acao_label && (
              <button
                style={{
                  padding: "2px 8px", borderRadius: 4,
                  background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)",
                  color: "#fca5a5", fontSize: 10, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                }}
              >
                {alert.acao_label}
              </button>
            )}
            <button
              onClick={() => onResolve(alert.id)}
              style={{
                padding: "2px 6px", borderRadius: 4,
                background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer",
              }}
              title="Resolver"
            >
              ✓
            </button>
            <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 10 }}>·</span>
          </div>
        ))}
      </div>
    </div>
  );
}
