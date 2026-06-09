"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import {
  RF_ACCENT,
  RF_BG_DEEP,
  RF_BG_PANEL,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_OVERLAY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideFooterStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Rótulo superior (ex.: VENDAS, ADMINISTRAÇÃO) */
  kindLabel?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  icon?: LucideIcon;
  /** Botões extras no header (ex.: abrir chat) */
  headerExtra?: ReactNode;
  /** Barra abaixo do título (ações, estágios, filtros) */
  headerToolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Drawer estreito (48rem) ou largo como catálogo de cargos */
  wide?: boolean;
  widthClass?: string;
  bodyClassName?: string;
};

/** Sideover escuro Waje — mesmo padrão do drawer de cargos em Agentes / Conta. */
export function CrmRetrofitSideoverShell({
  open,
  onClose,
  kindLabel,
  title,
  subtitle,
  badge,
  icon: Icon,
  headerExtra,
  headerToolbar,
  footer,
  children,
  wide = false,
  widthClass,
  bodyClassName,
}: Props) {
  if (!open) return null;

  const width =
    widthClass ?? (wide ? "max-w-[min(1180px,98vw)]" : "max-w-[48rem]");

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: RF_OVERLAY }}
        aria-label="Fechar painel"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative flex h-full w-full flex-col ${width}`}
        style={{
          background: RF_BG_DEEP,
          borderLeft: `1px solid ${RF_BORDER_STRONG}`,
          boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="flex-shrink-0 px-6 py-4"
          style={{ borderBottom: `1px solid ${RF_BORDER}`, background: RF_BG_PANEL }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {Icon ? <Icon size={16} style={{ color: RF_ACCENT, marginTop: 2, flexShrink: 0 }} /> : null}
              <div className="min-w-0">
                {kindLabel ? (
                  <p
                    className="m-0 text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: RF_TEXT_SECONDARY }}
                  >
                    {kindLabel}
                  </p>
                ) : null}
                <h3
                  className="text-base font-bold"
                  style={{ color: RF_TEXT_PRIMARY, margin: kindLabel ? "3px 0 0" : 0 }}
                >
                  {title}
                </h3>
                {subtitle ? (
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
                    {subtitle}
                  </p>
                ) : null}
                {badge ? <div className="mt-2 flex flex-wrap items-center gap-2">{badge}</div> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  background: "rgba(6, 13, 8, 0.6)",
                  color: RF_TEXT_SECONDARY,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {headerToolbar ? (
            <div
              className="mt-4 min-w-0"
              style={{ borderTop: `1px solid ${RF_BORDER}`, paddingTop: 14 }}
            >
              {headerToolbar}
            </div>
          ) : null}
        </div>

        <div
          className={
            bodyClassName ?? "min-h-0 flex-1 overflow-y-auto px-6 py-4"
          }
        >
          {children}
        </div>

        {footer ? (
          <div
            className="flex flex-shrink-0 items-center justify-end gap-2 px-6 py-4"
            style={rfAsideFooterStyle()}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function crmRetrofitSideoverFooterBtnCancel(onClick: () => void, disabled?: boolean) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl border px-4 text-sm font-medium disabled:opacity-60"
      style={{
        borderColor: RF_BORDER_STRONG,
        color: RF_TEXT_SECONDARY,
        background: "rgba(6, 13, 8, 0.6)",
      }}
    >
      Cancelar
    </button>
  );
}

export function crmRetrofitSideoverFooterBtnPrimary(
  label: string,
  onClick: () => void,
  disabled?: boolean
) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
      style={{ background: "#0b1f10", color: RF_ACCENT }}
    >
      {label}
    </button>
  );
}
