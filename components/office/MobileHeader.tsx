"use client";

interface MobileHeaderProps {
  activeTab: string;
  criticalCount: number;
  onlineCount: number;
}

const TAB_TITLES: Record<string, string> = {
  inbox:      "O que precisa de mim",
  escritorio: "Escritório Virtual",
  marketing:  "Marketing",
  hub:        "Hub Comercial",
  feed:       "Feed ao Vivo",
};

export default function MobileHeader({ activeTab, criticalCount, onlineCount }: MobileHeaderProps) {
  return (
    <div style={{
      height: 52,
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#0f172a",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      zIndex: 100,
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#22c55e" }}>obra10+</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          {TAB_TITLES[activeTab] ?? activeTab}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {criticalCount > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 20,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>{criticalCount} críticos</span>
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 20,
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 10, color: "#22c55e" }}>{onlineCount}</span>
        </div>
      </div>
    </div>
  );
}
