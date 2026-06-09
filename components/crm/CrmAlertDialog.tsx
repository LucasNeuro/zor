"use client";

import type { ReactNode } from "react";

export type CrmAlertDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  okLabel?: string;
  onClose: () => void;
  /** Tema claro (páginas CRM) ou escuro (drawers Waje) */
  theme?: "light" | "dark";
};

const LIGHT = {
  panel: "#ffffff",
  border: "rgba(201, 162, 74, 0.35)",
  title: "#0b2210",
  body: "#5d7a67",
  footerBorder: "#dcebd8",
  btnBg: "linear-gradient(180deg, #065535 0%, #003b26 100%)",
  btnBorder: "rgba(15, 81, 50, 0.9)",
  btnText: "#c9a24a",
};

const DARK = {
  panel: "linear-gradient(165deg, rgba(11, 31, 16, 0.97) 0%, rgba(6, 13, 8, 0.99) 100%)",
  border: "rgba(146, 255, 0, 0.22)",
  title: "#e8f5e9",
  body: "#b8d4bc",
  footerBorder: "rgba(146, 255, 0, 0.16)",
  btnBg: "rgba(146, 255, 0, 0.14)",
  btnBorder: "rgba(146, 255, 0, 0.35)",
  btnText: "#92ff00",
};

export function CrmAlertDialog({
  open,
  title,
  children,
  okLabel = "OK",
  onClose,
  theme = "light",
}: CrmAlertDialogProps) {
  if (!open) return null;

  const t = theme === "dark" ? DARK : LIGHT;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: theme === "dark" ? "rgba(11, 31, 16, 0.72)" : "rgba(1, 4, 9, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crm-alert-title"
        style={{
          maxWidth: 440,
          width: "100%",
          background: t.panel,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.border,
          borderRadius: 12,
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="crm-alert-title"
          style={{
            margin: 0,
            padding: "18px 20px 8px",
            fontSize: 16,
            fontWeight: 700,
            color: t.title,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <div
          style={{
            padding: "0 20px 16px",
            color: t.body,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {children}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 20px 18px",
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: t.footerBorder,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: t.btnBorder,
              background: t.btnBg,
              color: t.btnText,
            }}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
