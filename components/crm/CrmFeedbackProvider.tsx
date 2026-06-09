"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CrmAlertDialog } from "@/components/crm/CrmAlertDialog";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { CrmToastStack, type CrmToastItem } from "@/components/crm/CrmToast";
import type { CrmFeedbackTheme, CrmFeedbackVariant } from "@/lib/crm/crm-feedback-theme";

// ─── Toast ───────────────────────────────────────────────────────────────────

export type CrmToastOptions = {
  message: string;
  title?: string;
  variant?: CrmFeedbackVariant;
  theme?: CrmFeedbackTheme;
  durationMs?: number;
};

type CrmToastContextValue = {
  toast: (options: CrmToastOptions | string, variant?: CrmFeedbackVariant) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  /** @deprecated Use `success`. */
  toastSuccess: (message: string) => void;
  /** @deprecated Use `error`. */
  toastError: (message: string) => void;
  /** @deprecated Use `info`. */
  toastInfo: (message: string) => void;
};

const CrmToastContext = createContext<CrmToastContextValue | null>(null);

let toastSeq = 0;

function CrmToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CrmToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((opts: CrmToastOptions) => {
    const id = `crm-toast-${++toastSeq}`;
    const variant = opts.variant ?? "info";
    const durationMs = opts.durationMs ?? (variant === "destructive" ? 6500 : 4200);
    setItems((prev) => [
      ...prev.slice(-4),
      {
        id,
        title: opts.title,
        message: opts.message,
        variant,
        theme: opts.theme ?? "light",
        durationMs,
      },
    ]);
  }, []);

  const toast = useCallback(
    (options: CrmToastOptions | string, variant: CrmFeedbackVariant = "info") => {
      if (typeof options === "string") {
        pushToast({ message: options, variant });
      } else {
        pushToast(options);
      }
    },
    [pushToast],
  );

  const success = useCallback(
    (message: string, title?: string) => pushToast({ message, title, variant: "success" }),
    [pushToast],
  );
  const error = useCallback(
    (message: string, title?: string) => pushToast({ message, title, variant: "destructive" }),
    [pushToast],
  );
  const info = useCallback(
    (message: string, title?: string) => pushToast({ message, title, variant: "info" }),
    [pushToast],
  );
  const warning = useCallback(
    (message: string, title?: string) => pushToast({ message, title, variant: "warning" }),
    [pushToast],
  );

  const value = useMemo(
    () => ({
      toast,
      success,
      error,
      info,
      warning,
      toastSuccess: success,
      toastError: error,
      toastInfo: info,
    }),
    [toast, success, error, info, warning],
  );

  return (
    <CrmToastContext.Provider value={value}>
      {children}
      <CrmToastStack items={items} onDismiss={dismiss} />
    </CrmToastContext.Provider>
  );
}

export function useCrmToast(): CrmToastContextValue {
  const ctx = useContext(CrmToastContext);
  if (!ctx) throw new Error("useCrmToast deve ser usado dentro de CrmFeedbackProvider");
  return ctx;
}

// ─── Confirm ─────────────────────────────────────────────────────────────────

export type CrmConfirmDialogOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: CrmFeedbackVariant;
  /** @deprecated Prefer `variant="destructive"`. */
  danger?: boolean;
  theme?: CrmFeedbackTheme;
};

type CrmConfirmContextValue = {
  confirmDialog: (options: CrmConfirmDialogOptions) => Promise<boolean>;
  /** @deprecated Use `confirmDialog`. */
  confirm: (options: CrmConfirmDialogOptions) => Promise<boolean>;
  setConfirmLoading: (loading: boolean) => void;
  closeConfirmDialog: () => void;
};

const CrmConfirmContext = createContext<CrmConfirmContextValue | null>(null);

type ConfirmState = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: CrmFeedbackVariant;
  danger?: boolean;
  theme?: CrmFeedbackTheme;
  loading: boolean;
  /** Utilizador confirmou — aguarda `closeConfirmDialog` após operação async. */
  confirmed: boolean;
};

function CrmConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    loading: false,
    confirmed: false,
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirmDialog = useCallback((options: CrmConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        children: options.message,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        variant: options.variant,
        danger: options.danger,
        theme: options.theme,
        loading: false,
        confirmed: false,
      });
    });
  }, []);

  const setConfirmLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, loading }));
  }, []);

  const closeConfirmDialog = useCallback(() => {
    resolverRef.current = null;
    setState({
      open: false,
      title: "",
      loading: false,
      confirmed: false,
    });
  }, []);

  const cancelDialog = useCallback(() => {
    setState((s) => {
      if (s.loading || s.confirmed) return s;
      resolverRef.current?.(false);
      resolverRef.current = null;
      return { open: false, title: "", loading: false, confirmed: false };
    });
  }, []);

  const acceptDialog = useCallback(() => {
    setState((s) => {
      if (s.loading || s.confirmed) return s;
      resolverRef.current?.(true);
      return { ...s, confirmed: true };
    });
  }, []);

  const value = useMemo(
    () => ({ confirmDialog, confirm: confirmDialog, setConfirmLoading, closeConfirmDialog }),
    [confirmDialog, setConfirmLoading, closeConfirmDialog],
  );

  return (
    <CrmConfirmContext.Provider value={value}>
      {children}
      <CrmConfirmDialog
        open={state.open}
        title={state.title}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        danger={state.danger}
        theme={state.theme}
        loading={state.loading}
        zIndex={state.theme === "dark" ? 320 : undefined}
        onCancel={cancelDialog}
        onConfirm={acceptDialog}
      >
        {state.children}
      </CrmConfirmDialog>
    </CrmConfirmContext.Provider>
  );
}

export function useCrmConfirm(): CrmConfirmContextValue {
  const ctx = useContext(CrmConfirmContext);
  if (!ctx) throw new Error("useCrmConfirm deve ser usado dentro de CrmFeedbackProvider");
  return ctx;
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export type CrmAlertDialogOptions = {
  title: string;
  message?: ReactNode;
  okLabel?: string;
  theme?: CrmFeedbackTheme;
};

type CrmAlertContextValue = {
  alertDialog: (options: CrmAlertDialogOptions) => Promise<void>;
};

const CrmAlertContext = createContext<CrmAlertContextValue | null>(null);

type AlertState = {
  open: boolean;
  title: string;
  children?: ReactNode;
  okLabel?: string;
  theme?: CrmFeedbackTheme;
};

function CrmAlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlertState>({ open: false, title: "" });
  const resolverRef = useRef<(() => void) | null>(null);

  const alertDialog = useCallback((options: CrmAlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        children: options.message,
        okLabel: options.okLabel,
        theme: options.theme,
      });
    });
  }, []);

  function close() {
    setState((s) => ({ ...s, open: false }));
    resolverRef.current?.();
    resolverRef.current = null;
  }

  return (
    <CrmAlertContext.Provider value={{ alertDialog }}>
      {children}
      <CrmAlertDialog
        open={state.open}
        title={state.title}
        okLabel={state.okLabel}
        theme={state.theme}
        onClose={close}
      >
        {state.children}
      </CrmAlertDialog>
    </CrmAlertContext.Provider>
  );
}

function useCrmAlert(): CrmAlertContextValue {
  const ctx = useContext(CrmAlertContext);
  if (!ctx) throw new Error("useCrmAlert deve ser usado dentro de CrmFeedbackProvider");
  return ctx;
}

// ─── Combined ────────────────────────────────────────────────────────────────

export function useCrmFeedback() {
  const toast = useCrmToast();
  const confirm = useCrmConfirm();
  const alert = useCrmAlert();
  return { ...toast, ...confirm, ...alert };
}

/** Provider unificado de toast, confirm e alert para rotas CRM. */
export function CrmFeedbackProvider({ children }: { children: ReactNode }) {
  return (
    <CrmToastProvider>
      <CrmConfirmProvider>
        <CrmAlertProvider>{children}</CrmAlertProvider>
      </CrmConfirmProvider>
    </CrmToastProvider>
  );
}
