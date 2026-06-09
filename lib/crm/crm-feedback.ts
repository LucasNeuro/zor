/**
 * Sistema unificado de alerts, confirms e toasts Waje CRM.
 *
 * @example
 * ```tsx
 * import { useCrmFeedback } from "@/lib/crm/crm-feedback";
 *
 * const { toastSuccess, confirmDialog, alertDialog } = useCrmFeedback();
 * ```
 */
export {
  CrmFeedbackProvider,
  useCrmFeedback,
  useCrmToast,
  useCrmConfirm,
  type CrmToastOptions,
  type CrmConfirmDialogOptions,
  type CrmAlertDialogOptions,
} from "@/components/crm/CrmFeedbackProvider";

export { CrmConfirmDialog, type CrmConfirmDialogProps } from "@/components/crm/CrmConfirmDialog";
export { CrmAlertDialog, type CrmAlertDialogProps } from "@/components/crm/CrmAlertDialog";
export { CrmToastStack, type CrmToastItem } from "@/components/crm/CrmToast";

export type { CrmFeedbackVariant, CrmFeedbackTheme } from "@/lib/crm/crm-feedback-theme";
export {
  crmDialogShell,
  crmDialogVariant,
  crmToastTokens,
  crmFeedbackVariantFromDanger,
} from "@/lib/crm/crm-feedback-theme";
