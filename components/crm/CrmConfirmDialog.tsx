"use client";

import type { ReactNode } from "react";

export type CrmConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** true = botão principal vermelho (exclusão); false = destaque dourado */
  danger?: boolean;
  loading?: boolean;
};

export function CrmConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onCancel,
  onConfirm,
  danger = false,
  loading = false,
}: CrmConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(1, 4, 9, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crm-confirm-title"
        style={{
          maxWidth: 440,
          width: "100%",
          background: "#ffffff",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: danger ? "rgba(179, 38, 30, 0.45)" : "rgba(201, 162, 74, 0.35)",
          borderRadius: 12,
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.55)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="crm-confirm-title"
          style={{
            margin: 0,
            padding: "18px 20px 8px",
            fontSize: 16,
            fontWeight: 700,
            color: "#0b2210",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        <div
          style={{
            padding: "0 20px 16px",
            color: "#5d7a67",
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
            gap: 10,
            padding: "12px 20px 18px",
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "#dcebd8",
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "#dcebd8",
              background: "#eef7eb",
              color: "#5d7a67",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: danger ? "rgba(179, 38, 30, 0.55)" : "rgba(15, 81, 50, 0.9)",
              background: danger ? "rgba(179, 38, 30, 0.18)" : "linear-gradient(180deg, #065535 0%, #003b26 100%)",
              color: danger ? "#ffb4ab" : "#c9a24a",
            }}
          >
            {loading ? "A processar…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
