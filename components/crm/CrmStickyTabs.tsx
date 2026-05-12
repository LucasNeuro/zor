"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

export type CrmStickyTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type CrmStickyTabsProps = {
  tabs: CrmStickyTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Abas largas: rolagem horizontal em vez de dividir espaço igualmente. */
  scrollable?: boolean;
  className?: string;
  style?: CSSProperties;
};

const BAR: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 25,
  flexShrink: 0,
  display: "flex",
  background: "rgba(13, 17, 23, 0.94)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  borderBottom: "1px solid #30363d",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
};

export function CrmStickyTabs({
  tabs,
  activeId,
  onChange,
  scrollable = false,
  className,
  style,
}: CrmStickyTabsProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={className}
      style={{ ...BAR, ...style }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          minWidth: 0,
          overflowX: scrollable ? "auto" : undefined,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((t) => {
          const active = activeId === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`crm-tab-${t.id}`}
              onClick={() => onChange(t.id)}
              className="flex items-center justify-center gap-2 py-3 text-sm transition-colors"
              style={{
                flex: scrollable ? "0 0 auto" : 1,
                minWidth: scrollable ? undefined : 0,
                paddingLeft: scrollable ? 14 : undefined,
                paddingRight: scrollable ? 14 : undefined,
                color: active ? "#c9a24a" : "#8b949e",
                background: "transparent",
                cursor: "pointer",
                outline: "none",
                border: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                borderBottom: active ? "2px solid #c9a24a" : "2px solid transparent",
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
