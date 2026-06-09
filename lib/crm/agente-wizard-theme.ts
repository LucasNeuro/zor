import type { CSSProperties } from "react";
import { RF, RF_INPUT_STYLE } from "@/lib/crm/crm-retrofit-dark-theme";
import {
  crmBtnChoiceCard,
  crmBtnChoicePill,
  crmBtnOutline,
  crmBtnPrimaryLg,
  crmBtnSecondaryLg,
  crmInfoBox,
} from "@/lib/crm/crm-button-styles";

/** Tokens e helpers visuais do AgenteNovoWizard (drawer escuro vs página clara). */
export function createAgenteWizardTheme(wizardDark: boolean) {
  const wzTitulo = wizardDark ? RF.texto : "#0b2210";
  const wzTexto = wizardDark ? RF.texto2 : "#5d7a67";
  const wzMuted = wizardDark ? RF.texto3 : "#5d7a67";
  const wzStrong = wizardDark ? RF.limao : "#0b2210";
  const wzDivider = wizardDark ? RF.borda : "#dcebd8";

  const wzH2: CSSProperties = {
    color: wzTitulo,
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 4px",
  };

  const wzP: CSSProperties = {
    color: wzTexto,
    fontSize: 13,
    margin: 0,
    lineHeight: 1.55,
  };

  const wzSectionLabel: CSSProperties = wizardDark
    ? { color: RF.limao, fontSize: 11, fontWeight: 700, marginBottom: 8 }
    : { color: "#5d7a67", fontSize: 11, fontWeight: 700, marginBottom: 8 };

  const wzLabel: CSSProperties = wizardDark
    ? {
        color: RF.limao,
        fontSize: 12,
        fontWeight: 700,
        display: "block",
        marginBottom: 8,
      }
    : { fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 };

  const wzCard = (extra?: CSSProperties): CSSProperties => ({
    ...(wizardDark
      ? { background: "rgba(11, 31, 16, 0.92)", border: `1px solid ${RF.borda}` }
      : { background: "#ffffff", border: "1px solid #dcebd8" }),
    borderRadius: 12,
    ...extra,
  });

  const wzPanelWrap = (extra?: CSSProperties): CSSProperties =>
    wizardDark
      ? { display: "flex", flexDirection: "column", gap: 20, ...extra }
      : {
          display: "flex",
          flexDirection: "column",
          gap: 20,
          background: "#f8fcf6",
          border: "1px solid #dcebd8",
          borderRadius: 14,
          padding: 18,
          ...extra,
        };

  const wzInput: CSSProperties = wizardDark
    ? {
        ...RF_INPUT_STYLE,
        width: "100%",
        padding: "10px 14px",
        fontSize: 14,
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        background: "#ffffff",
        border: "1px solid #dcebd8",
        color: "#0b2210",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
      };

  const wzTextarea: CSSProperties = wizardDark
    ? {
        ...RF_INPUT_STYLE,
        width: "100%",
        padding: "10px 12px",
        fontSize: 13,
        lineHeight: 1.5,
        resize: "vertical",
        fontFamily: "inherit",
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        background: "#f8fcf6",
        border: "1px solid #dcebd8",
        color: "#0b2210",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        lineHeight: 1.5,
        resize: "vertical",
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
      };

  const chip = (ativo: boolean, cor?: string): CSSProperties => {
    if (wizardDark) {
      const accent = cor || RF.limao;
      return {
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${ativo ? accent : RF.borda}`,
        background: ativo
          ? cor
            ? `${cor}44`
            : "rgba(146, 255, 0, 0.22)"
          : "rgba(6, 13, 8, 0.85)",
        color: ativo ? (cor || RF.limao) : RF.texto2,
        transition: "all 150ms",
      };
    }
    return {
      padding: "6px 14px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: `1px solid ${ativo ? cor || "#92ff00" : "#dcebd8"}`,
      background: ativo ? (cor ? cor + "22" : "#ecffd8") : "#ffffff",
      color: ativo ? cor || "#0b1f10" : "#5d7a67",
      transition: "all 150ms",
    };
  };

  const cargoCard = (ativo: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    textAlign: "left",
    padding: 16,
    borderRadius: 12,
    cursor: "pointer",
    background: wizardDark ? "rgba(11, 31, 16, 0.92)" : "#ffffff",
    border: `2px solid ${
      wizardDark ? (ativo ? RF.limao : RF.borda) : ativo ? "#c9a24a" : "#dcebd8"
    }`,
    transition: "border-color 150ms",
  });

  const wizardBtnPrimary = (disabled = false, opts?: { fullWidth?: boolean }): CSSProperties => {
    if (!wizardDark) return crmBtnPrimaryLg(disabled, opts);
    const base: CSSProperties = {
      borderRadius: 8,
      padding: "12px 16px",
      fontSize: 13,
      fontWeight: 700,
      ...(opts?.fullWidth ? { width: "100%" } : { flex: 1 }),
    };
    if (disabled) {
      return {
        ...base,
        background: "rgba(6, 13, 8, 0.55)",
        color: RF.texto3,
        border: `1px solid ${RF.borda}`,
        cursor: "not-allowed",
      };
    }
    return {
      ...base,
      background: RF.limao,
      color: RF.surface,
      border: "none",
      cursor: "pointer",
      boxShadow: "0 2px 12px rgba(146, 255, 0, 0.28)",
    };
  };

  const wizardBtnSecondary = (disabled = false): CSSProperties => {
    if (!wizardDark) return crmBtnSecondaryLg(disabled);
    return {
      flex: 1,
      padding: "12px 0",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      background: "rgba(6, 13, 8, 0.72)",
      border: `1px solid ${RF.borda}`,
      color: disabled ? RF.texto3 : RF.texto,
      cursor: disabled ? "not-allowed" : "pointer",
    };
  };

  const wizardChoiceCard = (selected: boolean): CSSProperties => {
    if (!wizardDark) return crmBtnChoiceCard(selected);
    return {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      textAlign: "left",
      padding: "12px 14px",
      borderRadius: 10,
      cursor: "pointer",
      border: `1px solid ${selected ? RF.limao : RF.borda}`,
      background: selected ? "rgba(146, 255, 0, 0.1)" : "rgba(6, 13, 8, 0.85)",
    };
  };

  const wizardChoicePill = (selected: boolean): CSSProperties => {
    if (!wizardDark) return crmBtnChoicePill(selected);
    if (selected) {
      return {
        flex: "1 1 140px",
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        border: `1px solid ${RF.limao}`,
        background: RF.limao,
        color: RF.surface,
        boxShadow: "0 2px 12px rgba(146, 255, 0, 0.22)",
      };
    }
    return {
      flex: "1 1 140px",
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: `1px solid ${RF.borda}`,
      background: "rgba(6, 13, 8, 0.85)",
      color: RF.texto2,
    };
  };

  const wizardInfoBox = (): CSSProperties => {
    if (!wizardDark) return crmInfoBox();
    return {
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${RF.borda}`,
      background: "rgba(11, 31, 16, 0.72)",
      color: RF.texto2,
      fontSize: 12,
      lineHeight: 1.5,
    };
  };

  const wizardOutline = (disabled: boolean): CSSProperties => {
    if (!wizardDark) return crmBtnOutline(disabled);
    if (disabled) {
      return {
        borderRadius: 8,
        border: `1px solid ${RF.borda}`,
        background: "rgba(6, 13, 8, 0.45)",
        color: RF.texto3,
        fontSize: 12,
        fontWeight: 700,
        padding: "8px 14px",
        cursor: "not-allowed",
      };
    }
    return {
      borderRadius: 8,
      border: `1px solid ${RF.limao}`,
      background: "rgba(146, 255, 0, 0.08)",
      color: RF.limao,
      fontSize: 12,
      fontWeight: 700,
      padding: "8px 14px",
      cursor: "pointer",
    };
  };

  const stepCircle = (ativo: boolean, passado: boolean): CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
    background: wizardDark
      ? passado
        ? RF.panel
        : ativo
          ? RF.limao
          : "rgba(11, 31, 16, 0.92)"
      : passado
        ? "#0b1f10"
        : ativo
          ? "#92ff00"
          : "#eef7eb",
    border: `2px solid ${
      wizardDark
        ? passado || ativo
          ? RF.limao
          : RF.borda
        : passado
          ? "#0b1f10"
          : ativo
            ? "#92ff00"
            : "#dcebd8"
    }`,
    color: wizardDark
      ? passado
        ? RF.limao
        : ativo
          ? RF.surface
          : RF.texto2
      : passado
        ? "#92ff00"
        : ativo
          ? "#0b1f10"
          : "#5d7a67",
  });

  const stepLabel = (ativo: boolean): CSSProperties => ({
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.2,
    color: wizardDark ? (ativo ? RF.limao : RF.texto2) : ativo ? "#0b1f10" : "#5d7a67",
  });

  const stepConnector = (passado: boolean): CSSProperties => ({
    flex: 1,
    height: 2,
    minWidth: 8,
    background: wizardDark
      ? passado
        ? RF.limao
        : "rgba(63, 152, 72, 0.35)"
      : passado
        ? "#92ff00"
        : "#dcebd8",
  });

  return {
    RF,
    wizardDark,
    wzTitulo,
    wzTexto,
    wzMuted,
    wzStrong,
    wzDivider,
    wzH2,
    wzP,
    wzSectionLabel,
    wzLabel,
    wzCard,
    wzPanelWrap,
    wzInput,
    wzTextarea,
    chip,
    cargoCard,
    wizardBtnPrimary,
    wizardBtnSecondary,
    wizardChoiceCard,
    wizardChoicePill,
    wizardInfoBox,
    wizardOutline,
    stepCircle,
    stepLabel,
    stepConnector,
  };
}

export type AgenteWizardTheme = ReturnType<typeof createAgenteWizardTheme>;
