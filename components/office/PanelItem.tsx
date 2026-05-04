"use client";

export interface PanelItemProps {
  icon: string;
  label: string;
  badge?: string | number;
  alertCount?: number;
  severity?: "critical" | "warning" | "info" | "ok";
  isActive: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  onVerTudo?: () => void;
}

const SEV = {
  critical: { dot: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
  warning:  { dot: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)"  },
  info:     { dot: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  ok:       { dot: "#22c55e", bg: "transparent",           border: "transparent"          },
};

export function PanelItem({
  icon, label, badge, alertCount, severity = "ok",
  isActive, onToggle, children, onVerTudo,
}: PanelItemProps) {
  const c = SEV[severity];
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      ...(isActive
        ? { flex: 1, minHeight: 0 }
        : { height: 32, flexShrink: 0 }),
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      overflow: "hidden",
    }}>
      {/* Header row — always 32px */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "0 12px", height: 32, flexShrink: 0,
          cursor: "pointer",
          background: isActive ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 150ms",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, flex: 1,
          color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
          transition: "color 150ms",
        }}>
          {label}
        </span>

        {alertCount != null && alertCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8,
            background: c.bg, border: `1px solid ${c.border}`,
            color: c.dot, flexShrink: 0,
          }}>
            {alertCount}
          </span>
        )}

        {badge != null && (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
            {badge}
          </span>
        )}

        <span style={{
          fontSize: 8, color: "rgba(255,255,255,0.18)", flexShrink: 0,
          transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 200ms", display: "inline-block",
        }}>▼</span>
      </div>

      {/* Content area — only when active, scrollable */}
      {isActive && (
        <div
          className="panel-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "8px 12px 10px" }}
        >
          {children}
          {onVerTudo && (
            <button
              onClick={(e) => { e.stopPropagation(); onVerTudo(); }}
              style={{
                marginTop: 8, width: "100%", padding: "5px 0", borderRadius: 6,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer",
              }}
            >
              Abrir detalhes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
