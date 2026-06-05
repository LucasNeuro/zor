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
  /**
   * Três (ou N) abas em colunas iguais, centro, sem scroll horizontal — útil na ficha do lead.
   * Quando true, `scrollable` é ignorado.
   */
  equalColumns?: boolean;
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
  borderBottom: "1px solid #dcebd8",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
};

export function CrmStickyTabs({
  tabs,
  activeId,
  onChange,
  scrollable = false,
  equalColumns = false,
  className,
  style,
}: CrmStickyTabsProps) {
  const useScroll = scrollable && !equalColumns;

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
          overflowX: useScroll ? "auto" : "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((t) => {
          const active = activeId === t.id;
          const Icon = t.icon;
          const equal = equalColumns;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`crm-tab-${t.id}`}
              onClick={() => onChange(t.id)}
              className={`transition-colors ${equal ? "flex flex-col items-center justify-center gap-1 px-1 py-2.5 sm:flex-row sm:gap-2 sm:py-3" : "flex items-center justify-center gap-2 py-3 text-sm"}`}
              style={{
                flex: useScroll ? "0 0 auto" : 1,
                minWidth: useScroll ? undefined : 0,
                paddingLeft: useScroll ? 14 : undefined,
                paddingRight: useScroll ? 14 : undefined,
                color: active ? "#c9a24a" : "#5d7a67",
                background: "transparent",
                cursor: "pointer",
                outline: "none",
                border: "none",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                borderBottom: active ? "2px solid #c9a24a" : "2px solid transparent",
                marginBottom: -1,
                whiteSpace: equal ? "normal" : "nowrap",
                textAlign: equal ? "center" : undefined,
                fontSize: equal ? 12 : 14,
                lineHeight: equal ? 1.25 : undefined,
              }}
            >
              <Icon size={equal ? 16 : 18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
              <span className={equal ? "max-w-full break-words" : "truncate"}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
