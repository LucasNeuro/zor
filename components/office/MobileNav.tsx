"use client";

export type MobileTab = "inbox" | "escritorio" | "marketing" | "hub" | "feed";

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  criticalCount: number;
}

export default function MobileNav({ activeTab, onTabChange, criticalCount }: MobileNavProps) {
  const tabs = [
    { id: "inbox" as MobileTab,     label: "Decisões",   icon: "🎯", badge: criticalCount > 0 ? criticalCount : null, badgeColor: "#ef4444" },
    { id: "escritorio" as MobileTab, label: "Escritório", icon: "🏢", badge: null, badgeColor: null },
    { id: "marketing" as MobileTab,  label: "Marketing",  icon: "📢", badge: null, badgeColor: null },
    { id: "hub" as MobileTab,        label: "Hub",        icon: "🤝", badge: null, badgeColor: null },
    { id: "feed" as MobileTab,       label: "Feed",       icon: "⚡", badge: null, badgeColor: null },
  ];

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 64,
      background: "#0f172a",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      zIndex: 500,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            position: "relative",
            borderTop: activeTab === tab.id ? "2px solid #22c55e" : "2px solid transparent",
            transition: "all 150ms",
          }}
        >
          {tab.badge != null && (
            <div style={{
              position: "absolute",
              top: 8, right: "25%",
              width: 16, height: 16,
              borderRadius: "50%",
              background: tab.badgeColor ?? "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 700,
              color: "white",
            }}>
              {tab.badge}
            </div>
          )}
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span style={{
            fontSize: 9,
            color: activeTab === tab.id ? "#22c55e" : "rgba(255,255,255,0.4)",
            fontWeight: activeTab === tab.id ? 700 : 400,
            letterSpacing: "0.02em",
          }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
