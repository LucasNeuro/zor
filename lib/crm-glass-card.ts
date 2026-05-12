import type { CSSProperties } from "react";

/** Grade fixa em 3 colunas (cards por linha). */
export const CRM_ENTITY_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

export function crmGlassCardSurface(selecionado: boolean): CSSProperties {
  return {
    background: "rgba(17, 24, 39, 0.82)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: 16,
    border: selecionado
      ? "1px solid rgba(147, 197, 253, 0.5)"
      : "1px solid rgba(96, 165, 250, 0.22)",
    boxShadow: selecionado
      ? "0 0 28px rgba(59, 130, 246, 0.2), 0 12px 40px rgba(0, 0, 0, 0.4)"
      : "0 0 20px rgba(59, 130, 246, 0.1), 0 8px 28px rgba(0, 0, 0, 0.3)",
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
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    border: "1px solid rgba(186, 230, 253, 0.4)",
    boxShadow: `0 0 14px ${accent}99, 0 0 26px rgba(59, 130, 246, 0.22)`,
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
    border: "1px solid rgba(147, 197, 253, 0.45)",
    background: "rgba(30, 41, 59, 0.65)",
    color: "#e2e8f0",
    boxShadow: "0 0 12px rgba(59, 130, 246, 0.15)",
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
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "rgba(30, 41, 59, 0.5)",
    color: "#cbd5e1",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  };
}
