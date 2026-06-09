import type { CSSProperties } from "react";
import { BRAND_GREEN_BRIGHT, BRAND_MARK_BG } from "@/lib/brand";

/**
 * Tema escuro Waje — usar apenas em sideovers/drawers (painéis laterais).
 * Páginas e fichas CRM mantêm o tema claro (#f8fcf6 / cartões brancos).
 */
export const RF_BG_DEEP = "#060d08";
export const RF_BG_PANEL = BRAND_MARK_BG;
export const RF_BG_CARD =
  "linear-gradient(165deg, rgba(11, 31, 16, 0.97) 0%, rgba(6, 13, 8, 0.99) 100%)";
export const RF_BORDER = "rgba(146, 255, 0, 0.16)";
export const RF_BORDER_STRONG = "rgba(63, 152, 72, 0.42)";
export const RF_TEXT_PRIMARY = "#e8f5e9";
export const RF_TEXT_SECONDARY = "#b8d4bc";
export const RF_TEXT_MUTED = "#7a9a7e";
export const RF_TEXT_DIM = "#5d7a67";
export const RF_ACCENT = BRAND_GREEN_BRIGHT;
export const RF_ACCENT_SOFT = "#3f9848";
export const RF_OVERLAY = "rgba(11, 31, 16, 0.55)";

/**
 * Objeto curto para drawers que usam tokens nomeados (ex.: OB).
 * `verde` / `panel` = fundo — nunca usar como `color` de texto.
 */
export const RF = {
  /** Fundo painel (#0b1f10) — só background */
  verde: RF_BG_PANEL,
  panel: RF_BG_PANEL,
  limao: RF_ACCENT,
  destaque: RF_ACCENT,
  titulo: RF_TEXT_PRIMARY,
  borda: RF_BORDER_STRONG,
  bordaSoft: RF_BORDER,
  texto: RF_TEXT_PRIMARY,
  label: RF_ACCENT,
  texto2: RF_TEXT_SECONDARY,
  texto3: RF_TEXT_MUTED,
  surface: RF_BG_DEEP,
  shell: RF_BG_DEEP,
  danger: "#f85149",
  dangerMuted: "rgba(248, 81, 73, 0.14)",
  ok: "#3fb950",
  okMuted: "rgba(63, 185, 80, 0.14)",
};

export function rfHeadingStyle(fontSize = 18): CSSProperties {
  return { color: RF_TEXT_PRIMARY, fontSize, fontWeight: 800, margin: 0 };
}

export function rfSubheadingStyle(): CSSProperties {
  return {
    color: RF_TEXT_SECONDARY,
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: 700,
    margin: 0,
  };
}

export function rfBodyOnDarkStyle(): CSSProperties {
  return { color: RF_TEXT_SECONDARY, fontSize: 12, lineHeight: 1.45 };
}

export const RF_INPUT_STYLE: CSSProperties = {
  width: "100%",
  background: "rgba(6, 13, 8, 0.85)",
  border: `1px solid ${RF_BORDER_STRONG}`,
  color: RF_TEXT_PRIMARY,
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export const RF_LABEL_STYLE: CSSProperties = {
  color: RF_ACCENT,
  fontSize: 12,
  fontWeight: 700,
  display: "block",
  marginBottom: 6,
};

export const RF_SECTION_STYLE: CSSProperties = {
  marginTop: 4,
  paddingTop: 14,
  borderTop: `1px solid ${RF_BORDER}`,
};

export function rfInputStyle(): CSSProperties {
  return { ...RF_INPUT_STYLE };
}

export function rfLabelStyle(): CSSProperties {
  return { ...RF_LABEL_STYLE };
}

export function rfOverlayStyle(zIndex = 210): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex,
    background: RF_OVERLAY,
    border: "none",
    padding: 0,
    cursor: "pointer",
  };
}

export function rfAsideStyle(width: string | number = 480, zIndex = 211): CSSProperties {
  return {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    zIndex,
    width: typeof width === "number" ? `min(${width}px, 100vw)` : width,
    maxHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    background: RF_BG_DEEP,
    borderLeft: `1px solid ${RF_BORDER_STRONG}`,
    boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
  };
}

export function rfAsideHeaderStyle(): CSSProperties {
  return {
    borderBottom: `1px solid ${RF_BORDER}`,
    padding: 16,
    background: RF_BG_PANEL,
    flexShrink: 0,
  };
}

export function rfAsideBodyStyle(): CSSProperties {
  return {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: 16,
  };
}

export function rfAsideFooterStyle(): CSSProperties {
  return {
    flexShrink: 0,
    padding: "14px 20px",
    borderTop: `1px solid ${RF_BORDER}`,
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
    background: RF_BG_PANEL,
  };
}

export function rfCloseButtonStyle(): CSSProperties {
  return {
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6, 13, 8, 0.6)",
    color: RF_ACCENT,
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

export function rfInnerPanelStyle(): CSSProperties {
  return {
    background: RF_BG_PANEL,
    border: `1px solid ${RF_BORDER_STRONG}`,
    borderRadius: 12,
    overflow: "hidden",
  };
}
