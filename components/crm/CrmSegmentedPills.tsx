"use client";

import type { CSSProperties, ReactNode } from "react";

export type CrmSegmentedPillItem = {
  key: string;
  label: ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
};

const GROUP_SHELL: CSSProperties = {
  display: "inline-flex",
  alignItems: "stretch",
  borderRadius: 999,
  border: "1px solid #d4ecd0",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(11, 31, 16, 0.06)",
  flexShrink: 0,
};

function pillStyle(active: boolean, index: number, total: number): CSSProperties {
  return {
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    borderRight: index < total - 1 ? "1px solid #d4ecd0" : undefined,
    background: active ? "#ecffd8" : "#ffffff",
    color: active ? "#0b1f10" : "#5d7a67",
    whiteSpace: "nowrap",
  };
}

type Props = {
  items: CrmSegmentedPillItem[];
  "aria-label": string;
  className?: string;
};

/** Grupo segmentado de pills — mesmo padrão visual dos button groups do header CRM. */
export function CrmSegmentedPills({ items, "aria-label": ariaLabel, className }: Props) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <button
        type="button"
        title={item.title}
        onClick={item.onClick}
        style={{
          ...pillStyle(!!item.active, 0, 1),
          borderRadius: 999,
          border: "1px solid #d4ecd0",
          boxShadow: "0 2px 8px rgba(11, 31, 16, 0.06)",
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <div role="group" aria-label={ariaLabel} className={className} style={GROUP_SHELL}>
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          title={item.title}
          onClick={item.onClick}
          style={pillStyle(!!item.active, index, items.length)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
