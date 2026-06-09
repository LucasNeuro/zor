import type { CSSProperties } from "react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

export function crmBtnPrimary(disabled = false): CSSProperties {
  if (disabled) {
    return {
      background: "#4a6356",
      color: "#c8dcc8",
      border: "1px solid #dcebd8",
      borderRadius: 10,
      padding: "10px 16px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "not-allowed",
      whiteSpace: "nowrap",
    };
  }
  return {
    background: BRAND_TEXT_DARK,
    color: BRAND_GREEN_BRIGHT,
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(11, 31, 16, 0.12)",
  };
}

export function crmBtnSecondary(disabled = false): CSSProperties {
  return {
    background: "#ffffff",
    color: BRAND_TEXT_DARK,
    border: "1px solid #d4ecd0",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
  };
}

export function crmBtnDangerSoft(disabled = false): CSSProperties {
  return {
    background: "#fff5f5",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
  };
}

/** Botão compacto quadrado (ícone) — verde Waje. */
export function crmBtnIconGreen(disabled = false): CSSProperties {
  return {
    width: 38,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    borderRadius: 10,
    background: BRAND_GREEN_BRIGHT,
    color: BRAND_TEXT_DARK,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

/** Botão compacto quadrado (ícone) — vermelho (exclusão). */
export function crmBtnIconRed(disabled = false): CSSProperties {
  return {
    width: 38,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    borderRadius: 10,
    background: "#dc2626",
    color: "#ffffff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

/** Botão compacto quadrado (ícone) — preto + verde Waje. */
export function crmBtnIconPrimary(disabled = false): CSSProperties {
  return {
    width: 38,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    borderRadius: 10,
    background: BRAND_TEXT_DARK,
    color: BRAND_GREEN_BRIGHT,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

/** Botão principal largo — wizard e CTAs de formulário. */
export function crmBtnPrimaryLg(disabled = false, opts?: { fullWidth?: boolean }): CSSProperties {
  const fullWidth = opts?.fullWidth ?? false;
  const base: CSSProperties = {
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 700,
    ...(fullWidth ? { width: "100%" } : { flex: 1 }),
  };
  if (disabled) {
    return {
      ...base,
      background: "#4a6356",
      color: "#c8dcc8",
      border: "1px solid #dcebd8",
      cursor: "not-allowed",
    };
  }
  return {
    ...base,
    background: BRAND_TEXT_DARK,
    color: BRAND_GREEN_BRIGHT,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(11, 31, 16, 0.12)",
  };
}

/** Botão secundário largo — «Anterior», cancelar. */
export function crmBtnSecondaryLg(disabled = false): CSSProperties {
  return {
    flex: 1,
    padding: "12px 0",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    background: "#ffffff",
    border: "1px solid #d4ecd0",
    color: disabled ? "#8fad8f" : BRAND_TEXT_DARK,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

/** Botão outline compacto — ações secundárias (ex.: Selecionar arquivo). */
/** Destaque de texto / rótulo de secção no wizard Waje. */
export const CRM_ACCENT = "#2d6a4f";

const CHOICE_BORDER_ACTIVE = CRM_ACCENT;
const CHOICE_BORDER_IDLE = "#dcebd8";
const CHOICE_BG_ACTIVE = "#3f984818";
const CHOICE_BG_IDLE = "#ffffff";

/** Caixa informativa — verde suave Waje (avisos, dicas). */
export function crmInfoBox(): CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #dcebd8",
    background: "#eef7eb",
    color: "#5d7a67",
    fontSize: 12,
    lineHeight: 1.5,
  };
}

/** Opção em pílula (ex.: «Criar ciclo» / «Só associar»). */
export function crmBtnChoicePill(selected = false): CSSProperties {
  if (selected) {
    return {
      flex: "1 1 140px",
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: "none",
      background: BRAND_TEXT_DARK,
      color: BRAND_GREEN_BRIGHT,
      boxShadow: "0 2px 8px rgba(11, 31, 16, 0.12)",
    };
  }
  return {
    flex: "1 1 140px",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid #d4ecd0",
    background: CHOICE_BG_IDLE,
    color: BRAND_TEXT_DARK,
  };
}

/** Cartão de opção seleccionável (ex.: tipo de agente, modo de execução). */
export function crmBtnChoiceCard(selected = false): CSSProperties {
  return {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${selected ? CHOICE_BORDER_ACTIVE : CHOICE_BORDER_IDLE}`,
    background: selected ? CHOICE_BG_ACTIVE : CHOICE_BG_IDLE,
    cursor: "pointer",
  };
}

export function crmBtnOutline(disabled = false): CSSProperties {
  if (disabled) {
    return {
      borderRadius: 8,
      border: "1px solid #dcebd8",
      background: "#f0f4f0",
      color: "#8fad8f",
      fontSize: 12,
      fontWeight: 700,
      padding: "8px 12px",
      cursor: "not-allowed",
    };
  }
  return {
    borderRadius: 8,
    border: `1px solid ${BRAND_TEXT_DARK}`,
    background: "#ffffff",
    color: BRAND_TEXT_DARK,
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 12px",
    cursor: "pointer",
  };
}

export function crmBtnIconDanger(disabled = false): CSSProperties {
  return {
    width: 38,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "1px solid #fecaca",
    borderRadius: 10,
    background: "#ffffff",
    color: "#dc2626",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}
