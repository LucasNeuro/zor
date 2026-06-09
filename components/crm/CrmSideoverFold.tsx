"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { RF_ACCENT, RF_BORDER_STRONG, RF_TEXT_SECONDARY } from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerRight?: ReactNode;
  isFirst?: boolean;
};

export function CrmSideoverFold({
  title,
  open,
  onToggle,
  children,
  headerRight,
  isFirst = false,
}: Props) {
  return (
    <div
      style={{
        borderTop: isFirst ? "none" : `1px solid ${RF_BORDER_STRONG}`,
        marginTop: isFirst ? 0 : 6,
        paddingTop: isFirst ? 0 : 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 auto",
            minWidth: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "6px 0",
            color: RF_TEXT_SECONDARY,
            fontSize: 12,
            fontWeight: 700,
            textAlign: "left",
          }}
        >
          <ChevronRight
            size={16}
            strokeWidth={2}
            aria-hidden
            style={{
              flexShrink: 0,
              color: RF_ACCENT,
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
          <span>{title}</span>
        </button>
        {headerRight ? <div style={{ flexShrink: 0 }}>{headerRight}</div> : null}
      </div>
      {open ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}
