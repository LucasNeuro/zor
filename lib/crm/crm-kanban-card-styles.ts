import type { CSSProperties } from "react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

/** Shell de card kanban CRM — mesmo padrão visual do AgenteGridCard. */
export function crmKanbanCardShell(selected = false): CSSProperties {
  return {
    background: selected
      ? "linear-gradient(165deg, #ffffff 0%, #f4fbf1 100%)"
      : "linear-gradient(165deg, #ffffff 0%, #fafdfa 100%)",
    borderRadius: 18,
    border: selected ? "1.5px solid rgba(146, 255, 0, 0.55)" : "1px solid rgba(18, 56, 43, 0.14)",
    boxShadow: selected
      ? "0 0 0 1px rgba(146, 255, 0, 0.12), 0 16px 40px rgba(15, 56, 39, 0.12)"
      : "0 8px 24px rgba(15, 56, 39, 0.07)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    cursor: "pointer",
    transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
    minWidth: 0,
  };
}

export const CRM_KANBAN = {
  title: BRAND_TEXT_DARK,
  muted: "#6b8a76",
  body: "#5d7a67",
  accent: BRAND_GREEN_BRIGHT,
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export function crmKanbanStatusPill(active = true): CSSProperties {
  return {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.6,
    color: active ? BRAND_TEXT_DARK : "#6b8a76",
    background: active ? "rgba(146, 255, 0, 0.18)" : "rgba(18, 56, 43, 0.06)",
    border: `1px solid ${active ? "rgba(146, 255, 0, 0.45)" : "rgba(18, 56, 43, 0.12)"}`,
    borderRadius: 999,
    padding: "4px 8px",
  };
}
