"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/lib/alerts-system";

const SEV = {
  critical: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  dot: "#ef4444", label: "CRÍTICO" },
  warning:  { bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.3)",   dot: "#eab308", label: "ATENÇÃO" },
  info:     { bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", dot: "#60a5fa", label: "INFO"    },
};

export function ToastAlert({ alert, onDismiss }: { alert: Alert | null; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!alert) return;
    setLeaving(false);
    setVisible(true);
    const duration = alert.severity === "critical" ? 8000 : 4000;
    const dismissTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => { setVisible(false); onDismiss(); }, 300);
    }, duration);
    return () => clearTimeout(dismissTimer);
  }, [alert, onDismiss]);

  if (!alert || !visible) return null;
  const c = SEV[alert.severity];

  return (
    <div
      style={{
        position: "fixed", top: 64, right: 16, zIndex: 9999,
        width: 340, borderRadius: 10,
        background: "rgba(4,8,20,0.97)",
        border: `1px solid ${c.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${c.border}`,
        backdropFilter: "blur(12px)",
        transform: leaving ? "translateY(-120%)" : "translateY(0)",
        opacity: leaving ? 0 : 1,
        transition: "transform 300ms ease, opacity 300ms ease",
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 2, background: c.dot, width: "100%" }} />

      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, boxShadow: `0 0 6px ${c.dot}` }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: c.dot, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {c.label}
          </span>
          <button
            onClick={() => { setLeaving(true); setTimeout(() => { setVisible(false); onDismiss(); }, 300); }}
            style={{
              marginLeft: "auto", background: "transparent", border: "none",
              color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer", padding: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>
          {alert.titulo}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
          {alert.descricao}
        </div>
        {alert.acao_label && (
          <div style={{ marginTop: 8 }}>
            <button style={{
              padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
              background: c.bg, border: `1px solid ${c.border}`, color: c.dot,
            }}>
              {alert.acao_label}
            </button>
          </div>
        )}
      </div>

      {/* Progress drain bar */}
      <div style={{
        height: 2, background: c.dot, opacity: 0.4,
        animation: `drainBar ${alert.severity === "critical" ? 8 : 4}s linear forwards`,
        transformOrigin: "left",
      }} />
    </div>
  );
}
