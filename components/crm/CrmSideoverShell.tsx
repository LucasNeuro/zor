"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  RF_ACCENT,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
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
  width?: number;
  footer?: ReactNode;
  children: ReactNode;
};

export function CrmSideoverShell({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  footer,
  children,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(210)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-sideover-title"
        style={rfAsideStyle(width, 211)}
      >
        <div style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, paddingRight: 12 }}>
              <h2 id="crm-sideover-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: RF_TEXT_MUTED }}>{subtitle}</p>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          style={{
            ...rfAsideBodyStyle(),
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>

        {footer && <div style={rfAsideFooterStyle()}>{footer}</div>}
      </aside>
    </>
  );
}
