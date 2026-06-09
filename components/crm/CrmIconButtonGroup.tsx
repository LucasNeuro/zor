"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

export type CrmIconButtonVariant = "green" | "primary" | "outline" | "danger" | "red";

export type CrmIconButtonGroupItem = {
  key: string;
  variant: CrmIconButtonVariant;
  icon: ReactNode;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  "aria-label"?: string;
};

const GROUP_BORDER = "1px solid rgba(18, 56, 43, 0.14)";
const ITEM_DIVIDER = "1px solid rgba(18, 56, 43, 0.12)";

const ITEM_SIZE: CSSProperties = {
  width: 38,
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

function itemVariantStyle(variant: CrmIconButtonVariant, disabled: boolean): CSSProperties {
  const shared: CSSProperties = {
    ...ITEM_SIZE,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "opacity 140ms ease, background 140ms ease",
  };

  switch (variant) {
    case "green":
      return { ...shared, background: BRAND_GREEN_BRIGHT, color: BRAND_TEXT_DARK };
    case "primary":
      return { ...shared, background: BRAND_TEXT_DARK, color: BRAND_GREEN_BRIGHT };
    case "outline":
      return { ...shared, background: "#ffffff", color: BRAND_TEXT_DARK };
    case "danger":
      return { ...shared, background: "#ffffff", color: "#dc2626" };
    case "red":
      return { ...shared, background: "#dc2626", color: "#ffffff" };
    default:
      return shared;
  }
}

function groupedItemStyle(
  variant: CrmIconButtonVariant,
  disabled: boolean,
  index: number,
  total: number
): CSSProperties {
  return {
    ...itemVariantStyle(variant, disabled),
    borderRadius: 0,
    borderLeft: index > 0 ? ITEM_DIVIDER : undefined,
    ...(index === 0 ? { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 } : {}),
    ...(index === total - 1 ? { borderTopRightRadius: 10, borderBottomRightRadius: 10 } : {}),
  };
}

type Props = {
  items: CrmIconButtonGroupItem[];
  "aria-label": string;
  className?: string;
  style?: CSSProperties;
};

/** Grupo unificado de botões-ícone (cards de agente, ciclo, etc.). */
export function CrmIconButtonGroup({ items, "aria-label": ariaLabel, className, style }: Props) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <button
        type="button"
        title={item.title}
        aria-label={item["aria-label"]}
        disabled={item.disabled}
        onClick={item.onClick}
        style={{
          ...itemVariantStyle(item.variant, !!item.disabled),
          borderRadius: 10,
          border: GROUP_BORDER,
          boxShadow: "0 2px 8px rgba(11, 31, 16, 0.06)",
        }}
      >
        {item.loading ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span> : item.icon}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: 10,
        border: GROUP_BORDER,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(11, 31, 16, 0.06)",
        background: "#ffffff",
        ...style,
      }}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          title={item.title}
          aria-label={item["aria-label"]}
          disabled={item.disabled}
          onClick={item.onClick}
          style={groupedItemStyle(item.variant, !!item.disabled, index, items.length)}
        >
          {item.loading ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span> : item.icon}
        </button>
      ))}
    </div>
  );
}
