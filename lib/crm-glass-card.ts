import type { CSSProperties } from "react";

/** Grade fixa em 3 colunas (cards por linha). */
export const CRM_ENTITY_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

export function crmGlassCardSurface(selecionado: boolean): CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 16,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: selecionado
      ? "rgba(201, 162, 74, 0.58)"
      : "rgba(18, 56, 43, 0.16)",
    boxShadow: selecionado
      ? "0 0 26px rgba(201, 162, 74, 0.16), 0 12px 32px rgba(15, 56, 39, 0.12)"
      : "0 0 18px rgba(18, 56, 43, 0.06), 0 8px 22px rgba(15, 56, 39, 0.10)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    cursor: "pointer",
    transition: "border-color 150ms ease, box-shadow 150ms ease",
    minWidth: 0,
  };
}

export function crmAvatarGlow(accent: string): CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#12382b",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    border: "1px solid rgba(18, 56, 43, 0.2)",
    boxShadow: `0 0 10px ${accent}66, 0 0 18px rgba(18, 56, 43, 0.14)`,
    overflow: "hidden",
  };
}

export function crmFooterStatusPill(ativo: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "6px 14px",
    borderRadius: 999,
    background: ativo ? "#15803d" : "#b91c1c",
    color: "#fff",
    border: "none",
    flexShrink: 0,
  };
}

export function crmBtnExecutar(disabled: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(18, 56, 43, 0.2)",
    background: "#f6faf4",
    color: "#12382b",
    boxShadow: "0 0 10px rgba(18, 56, 43, 0.08)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
  };
}

export function crmBtnDesativar(disabled: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(95, 116, 105, 0.35)",
    background: "#f2f7f0",
    color: "#4f665b",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };
}
