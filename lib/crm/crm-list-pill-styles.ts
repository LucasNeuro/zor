import type { CSSProperties } from "react";

/** Pills da lista de agentes — reutilizado em pipelines CRM. */
export function crmListPillStyle(selected: boolean): CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${selected ? "rgba(146,255,0,0.55)" : "#d4ecd0"}`,
    background: selected ? "#ecffd8" : "#ffffff",
    color: selected ? "#0b1f10" : "#5d7a67",
    whiteSpace: "nowrap",
  };
}

export function crmListSearchStyle(): CSSProperties {
  return {
    minWidth: 220,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    background: "#ffffff",
    border: "1px solid #d4ecd0",
    color: "#0b2210",
    outline: "none",
  };
}

export function crmListSelectStyle(): CSSProperties {
  return {
    minWidth: 168,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "#ffffff",
    border: "1px solid #d4ecd0",
    color: "#0b2210",
  };
}

export function crmHeaderPrimaryBtnStyle(): CSSProperties {
  return {
    background: "#0b1f10",
    color: "#92ff00",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function crmHeaderGroupBtnStyle(active = false): CSSProperties {
  return {
    background: active ? "#ecffd8" : "#ffffff",
    color: active ? "#0b1f10" : "#5d7a67",
    border: "none",
    padding: "12px 18px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export const CRM_LIST_SECTION_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#5d7a67",
  margin: "0 0 10px",
  letterSpacing: 0.5,
};
