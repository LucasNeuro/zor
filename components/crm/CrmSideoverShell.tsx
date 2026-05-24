"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

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
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 210,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-sideover-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 211,
          width: "100%",
          maxWidth: width,
          height: "100%",
          maxHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "#0d1117",
          borderLeft: "1px solid #30363d",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "18px 20px 12px",
            borderBottom: "1px solid #21262d",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, paddingRight: 12 }}>
            <h2 id="crm-sideover-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e6edf3" }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8b949e" }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>{children}</div>

        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: "14px 20px",
              borderTop: "1px solid #21262d",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
