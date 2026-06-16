"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  type CrmSideoverTheme,
  rfAsideBodyStyle,
  rfAsideFooterStyle,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number | string;
  theme?: CrmSideoverTheme;
  footer?: ReactNode;
  children: ReactNode;
  /** Ocupa a viewport inteira (editor de fluxo, etc.). */
  fullscreen?: boolean;
};

export function CrmSideoverShell({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  theme = "dark",
  footer,
  children,
  fullscreen = false,
}: Props) {
  if (!open) return null;

  const titleColor = theme === "light" ? RF_LIGHT_TEXT_PRIMARY : RF_TEXT_PRIMARY;
  const subtitleColor = theme === "light" ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;
  const panelWidth = fullscreen ? "100vw" : width;
  const panelZ = fullscreen ? 220 : 211;

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(fullscreen ? 219 : 210, theme)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-sideover-title"
        style={{
          ...rfAsideStyle(panelWidth, panelZ, theme),
          ...(fullscreen
            ? {
                left: 0,
                right: 0,
                width: "100vw",
                borderLeft: "none",
                boxShadow: "none",
              }
            : {}),
        }}
      >
        <div style={rfAsideHeaderStyle(theme)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <h2 id="crm-sideover-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: titleColor }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: subtitleColor }}>{subtitle}</p>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle(theme)}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          style={{
            ...rfAsideBodyStyle(),
            padding: fullscreen ? "10px 14px" : "16px 20px",
            display: "flex",
            flexDirection: "column",
            ...(fullscreen
              ? {
                  overflow: "hidden",
                  minHeight: 0,
                }
              : {}),
          }}
        >
          {children}
        </div>

        {footer && <div style={rfAsideFooterStyle()}>{footer}</div>}
      </aside>
    </>
  );
}
