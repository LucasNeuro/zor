"use client";

import { useState } from "react";

/* ── Block ── */
export interface BlockProps {
  title: string;
  icon: string;
  badge: string | number;
  badgeColor?: string;
  defaultOpen?: boolean;
  hasAlert?: boolean;
  children: React.ReactNode;
  onVerTudo?: () => void;
}

export function Block({ title, icon, badge, badgeColor, defaultOpen, hasAlert, children, onVerTudo }: BlockProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", cursor: "pointer",
          background: open ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 200ms", userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasAlert && (
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#ef4444", boxShadow: "0 0 6px #ef4444",
              animation: "pulse 1.5s infinite", flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{icon}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10,
            background: badgeColor || "rgba(255,255,255,0.08)",
            color: badgeColor ? "white" : "rgba(255,255,255,0.6)",
          }}>
            {badge}
          </span>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.3)",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
          }}>▼</span>
        </div>
      </div>

      {open && (
        <div className="panel-block-content" style={{ padding: "0 12px 12px" }}>
          {children}
          {onVerTudo && (
            <button
              onClick={onVerTudo}
              style={{
                marginTop: 8, width: "100%", padding: "6px", borderRadius: 6,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)", fontSize: 10, cursor: "pointer",
                transition: "all 200ms",
              }}
            >
              Ver tudo →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ProgressBar ── */
export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{
      height: 3, borderRadius: 2,
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden", margin: "4px 0",
    }}>
      <div style={{
        height: "100%", borderRadius: 2,
        width: `${pct}%`, background: color,
        transition: "width 600ms ease",
      }} />
    </div>
  );
}

/* ── Semaforo ── */
export function Semaforo({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
  const c = colors[status];
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%",
      background: c,
      boxShadow: status === "red" ? `0 0 6px ${c}` : "none",
      animation: status === "red" ? "pulse 1.5s infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

/* ── ActionButton ── */
export function ActionButton({
  label, variant = "default", onClick,
}: {
  label: string; variant?: "danger" | "warning" | "default"; onClick?: () => void;
}) {
  const colors = {
    danger:  { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.3)",  text: "#ef4444" },
    warning: { bg: "rgba(234,179,8,0.15)",  border: "rgba(234,179,8,0.3)",  text: "#eab308" },
    default: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.7)" },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 8px", borderRadius: 5,
        background: c.bg, border: `1px solid ${c.border}`,
        color: c.text, fontSize: 10, cursor: "pointer",
        fontWeight: 600, transition: "all 150ms",
      }}
    >
      {label}
    </button>
  );
}
