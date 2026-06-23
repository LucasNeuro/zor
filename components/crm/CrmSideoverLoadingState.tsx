"use client";

import type { CSSProperties } from "react";
import {
  RF_ACCENT,
  RF_LIGHT_TEXT_MUTED,
  RF_TEXT_MUTED,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CrmSideoverLoadingStateProps = {
  /** Texto ao lado do spinner. */
  label?: string;
  theme?: CrmSideoverTheme;
  /** Centraliza verticalmente no painel (ex.: sideover inteiro a carregar). */
  centered?: boolean;
  minHeight?: number | string;
  className?: string;
  style?: CSSProperties;
};

export function CrmSideoverSpinner({
  size = 20,
  theme = "dark",
}: {
  size?: number;
  theme?: CrmSideoverTheme;
}) {
  const accent = RF_ACCENT;
  const track = theme === "light" ? "rgba(21, 128, 61, 0.16)" : "rgba(146, 255, 0, 0.14)";

  return (
    <span
      role="status"
      aria-hidden
      className="crm-sideover-spinner"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${track}`,
        borderTopColor: accent,
        borderRightColor: theme === "light" ? "rgba(21, 128, 61, 0.45)" : "rgba(146, 255, 0, 0.42)",
        boxShadow:
          theme === "light"
            ? "0 0 10px rgba(21, 128, 61, 0.12)"
            : "0 0 14px rgba(146, 255, 0, 0.14)",
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

/** Estado de carregamento padronizado para sideovers CRM (spinner + «A carregar…»). */
export function CrmSideoverLoadingState({
  label = "A carregar…",
  theme = "dark",
  centered = false,
  minHeight = centered ? 220 : undefined,
  className,
  style,
}: CrmSideoverLoadingStateProps) {
  const textColor = theme === "light" ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        alignItems: centered ? "center" : "flex-start",
        justifyContent: centered ? "center" : "flex-start",
        minHeight,
        padding: centered ? "24px 16px" : "4px 0",
        ...style,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <CrmSideoverSpinner theme={theme} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: textColor,
            letterSpacing: 0.01,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
