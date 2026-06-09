import type { CSSProperties } from "react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF,
  RF_ACCENT,
  RF_BG_DEEP,
  RF_BG_PANEL,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_OVERLAY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CrmFeedbackVariant = "destructive" | "warning" | "info" | "success";
export type CrmFeedbackTheme = "light" | "dark";

export type CrmDialogShellTokens = {
  overlay: CSSProperties;
  panel: CSSProperties;
  title: CSSProperties;
  body: CSSProperties;
  footer: CSSProperties;
  cancelBtn: CSSProperties;
  cancelBtnDisabled: CSSProperties;
};

export type CrmDialogVariantTokens = {
  panelBorder: string;
  confirmBtn: CSSProperties;
  confirmBtnDisabled: CSSProperties;
  accentBar?: string;
};

export type CrmToastTokens = {
  container: CSSProperties;
  accentBar: string;
  title: CSSProperties;
  message: CSSProperties;
  dismiss: CSSProperties;
};

const LIGHT_PAGE = "#f8fcf6";
const LIGHT_TEXT = BRAND_TEXT_DARK;
const LIGHT_MUTED = "#5d7a67";
const LIGHT_BORDER = "#dcebd8";

const VARIANT_LIGHT: Record<CrmFeedbackVariant, Omit<CrmDialogVariantTokens, "confirmBtnDisabled">> = {
  destructive: {
    panelBorder: "rgba(220, 38, 38, 0.38)",
    accentBar: "#dc2626",
    confirmBtn: {
      background: "#dc2626",
      color: "#ffffff",
      border: "1px solid rgba(220, 38, 38, 0.55)",
    },
  },
  warning: {
    panelBorder: "rgba(202, 138, 4, 0.42)",
    accentBar: "#ca8a04",
    confirmBtn: {
      background: BRAND_TEXT_DARK,
      color: "#fbbf24",
      border: `1px solid rgba(202, 138, 4, 0.45)`,
    },
  },
  info: {
    panelBorder: "rgba(63, 152, 72, 0.38)",
    accentBar: "#3f9848",
    confirmBtn: {
      background: BRAND_TEXT_DARK,
      color: BRAND_GREEN_BRIGHT,
      border: `1px solid rgba(146, 255, 0, 0.35)`,
    },
  },
  success: {
    panelBorder: "rgba(63, 185, 80, 0.42)",
    accentBar: "#3fb950",
    confirmBtn: {
      background: BRAND_TEXT_DARK,
      color: BRAND_GREEN_BRIGHT,
      border: `1px solid rgba(146, 255, 0, 0.35)`,
    },
  },
};

const VARIANT_DARK: Record<CrmFeedbackVariant, Omit<CrmDialogVariantTokens, "confirmBtnDisabled">> = {
  destructive: {
    panelBorder: "rgba(248, 81, 73, 0.45)",
    accentBar: RF.danger,
    confirmBtn: {
      background: RF.dangerMuted,
      color: RF.danger,
      border: `1px solid rgba(248, 81, 73, 0.55)`,
    },
  },
  warning: {
    panelBorder: "rgba(251, 191, 36, 0.38)",
    accentBar: "#fbbf24",
    confirmBtn: {
      background: "rgba(251, 191, 36, 0.12)",
      color: "#fbbf24",
      border: "1px solid rgba(251, 191, 36, 0.4)",
    },
  },
  info: {
    panelBorder: RF_BORDER_STRONG,
    accentBar: RF_ACCENT,
    confirmBtn: {
      background: RF_BG_PANEL,
      color: RF_ACCENT,
      border: `1px solid ${RF_BORDER_STRONG}`,
    },
  },
  success: {
    panelBorder: "rgba(63, 185, 80, 0.42)",
    accentBar: RF.ok,
    confirmBtn: {
      background: RF.okMuted,
      color: RF.ok,
      border: "1px solid rgba(63, 185, 80, 0.45)",
    },
  },
};

function btnBase(): CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function crmDialogShell(theme: CrmFeedbackTheme): CrmDialogShellTokens {
  if (theme === "dark") {
    return {
      overlay: {
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: RF_OVERLAY,
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      },
      panel: {
        maxWidth: 440,
        width: "100%",
        background: RF_BG_DEEP,
        borderRadius: 14,
        boxShadow: "0 24px 56px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(146, 255, 0, 0.08)",
        overflow: "hidden",
      },
      title: {
        margin: 0,
        padding: "18px 20px 8px",
        fontSize: 16,
        fontWeight: 700,
        color: RF_TEXT_PRIMARY,
        letterSpacing: "-0.02em",
      },
      body: {
        padding: "0 20px 16px",
        color: RF_TEXT_SECONDARY,
        fontSize: 13,
        lineHeight: 1.55,
      },
      footer: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        padding: "12px 20px 18px",
        borderTop: `1px solid ${RF_BORDER}`,
        background: RF_BG_PANEL,
      },
      cancelBtn: {
        ...btnBase(),
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: "rgba(6, 13, 8, 0.6)",
        color: RF_TEXT_MUTED,
      },
      cancelBtnDisabled: {
        cursor: "not-allowed",
        opacity: 0.55,
      },
    };
  }

  return {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: "rgba(11, 31, 16, 0.42)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    panel: {
      maxWidth: 440,
      width: "100%",
      background: LIGHT_PAGE,
      borderRadius: 14,
      boxShadow: "0 20px 48px rgba(11, 31, 16, 0.18), 0 0 0 1px rgba(146, 255, 0, 0.12)",
      overflow: "hidden",
    },
    title: {
      margin: 0,
      padding: "18px 20px 8px",
      fontSize: 16,
      fontWeight: 700,
      color: LIGHT_TEXT,
      letterSpacing: "-0.02em",
    },
    body: {
      padding: "0 20px 16px",
      color: LIGHT_MUTED,
      fontSize: 13,
      lineHeight: 1.55,
    },
    footer: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      padding: "12px 20px 18px",
      borderTop: `1px solid ${LIGHT_BORDER}`,
      background: "#ffffff",
    },
    cancelBtn: {
      ...btnBase(),
      border: "1px solid #d4ecd0",
      background: "#ffffff",
      color: LIGHT_MUTED,
      fontWeight: 600,
    },
    cancelBtnDisabled: {
      cursor: "not-allowed",
      opacity: 0.55,
    },
  };
}

export function crmDialogVariant(
  variant: CrmFeedbackVariant,
  theme: CrmFeedbackTheme
): CrmDialogVariantTokens {
  const src = theme === "dark" ? VARIANT_DARK[variant] : VARIANT_LIGHT[variant];
  return {
    ...src,
    panelBorder: src.panelBorder,
    confirmBtn: {
      ...btnBase(),
      ...src.confirmBtn,
    },
    confirmBtnDisabled: {
      cursor: "not-allowed",
      opacity: 0.65,
    },
  };
}

export function crmToastTokens(variant: CrmFeedbackVariant, theme: CrmFeedbackTheme): CrmToastTokens {
  const v = crmDialogVariant(variant, theme);
  const isDark = theme === "dark";

  return {
    container: {
      width: "min(360px, calc(100vw - 32px))",
      borderRadius: 12,
      background: isDark ? RF_BG_DEEP : "#ffffff",
      border: `1px solid ${v.panelBorder}`,
      boxShadow: isDark
        ? "0 12px 36px rgba(0,0,0,0.55)"
        : "0 12px 32px rgba(11, 31, 16, 0.14), 0 0 0 1px rgba(146, 255, 0, 0.08)",
      overflow: "hidden",
      pointerEvents: "auto" as const,
    },
    accentBar: v.accentBar ?? BRAND_GREEN_BRIGHT,
    title: {
      fontSize: 13,
      fontWeight: 700,
      color: isDark ? RF_TEXT_PRIMARY : LIGHT_TEXT,
      marginBottom: 2,
    },
    message: {
      fontSize: 12,
      color: isDark ? RF_TEXT_SECONDARY : LIGHT_MUTED,
      lineHeight: 1.45,
    },
    dismiss: {
      marginLeft: "auto",
      background: "transparent",
      border: "none",
      color: isDark ? RF_TEXT_MUTED : "#8fad8f",
      fontSize: 14,
      cursor: "pointer",
      padding: 0,
      lineHeight: 1,
    },
  };
}

/** Compat: `danger` prop antiga → variante destrutiva. */
export function crmFeedbackVariantFromDanger(danger?: boolean): CrmFeedbackVariant {
  return danger ? "destructive" : "info";
}
