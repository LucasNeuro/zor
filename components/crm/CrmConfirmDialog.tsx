"use client";

import type { ReactNode } from "react";
import {
  crmDialogShell,
  crmDialogVariant,
  crmFeedbackVariantFromDanger,
  type CrmFeedbackTheme,
  type CrmFeedbackVariant,
} from "@/lib/crm/crm-feedback-theme";

export type CrmConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** @deprecated Prefer `variant="destructive"`. */
  danger?: boolean;
  variant?: CrmFeedbackVariant;
  theme?: CrmFeedbackTheme;
  loading?: boolean;
  loadingLabel?: string;
  confirmDisabled?: boolean;
  zIndex?: number;
};

export function CrmConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onCancel,
  onConfirm,
  danger,
  variant,
  theme = "light",
  loading = false,
  loadingLabel = "A processar…",
  confirmDisabled = false,
  zIndex,
}: CrmConfirmDialogProps) {
  if (!open) return null;

  const resolvedVariant = variant ?? crmFeedbackVariantFromDanger(danger);
  const shell = crmDialogShell(theme);
  const v = crmDialogVariant(resolvedVariant, theme);

  return (
    <div
      role="presentation"
      style={{ ...shell.overlay, ...(zIndex != null ? { zIndex } : {}) }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crm-confirm-title"
        style={{
          ...shell.panel,
          border: `1px solid ${v.panelBorder}`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {v.accentBar ? (
          <div style={{ height: 3, background: v.accentBar, width: "100%" }} aria-hidden />
        ) : null}
        <h2 id="crm-confirm-title" style={shell.title}>
          {title}
        </h2>
        <div style={shell.body}>{children}</div>
        <div style={shell.footer}>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              ...shell.cancelBtn,
              ...(loading ? shell.cancelBtnDisabled : {}),
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
            style={{
              ...v.confirmBtn,
              ...(loading || confirmDisabled ? v.confirmBtnDisabled : {}),
            }}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
