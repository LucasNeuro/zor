"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  type CrmSideoverTheme,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfOverlayStyle,
  rfAsideFooterStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  open: boolean;
  onClose: () => void;
  kindLabel?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  icon?: LucideIcon;
  headerExtra?: ReactNode;
  headerToolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  widthClass?: string;
  bodyClassName?: string;
  /** Claro em conversas/negócio no lead; escuro no restante do CRM. */
  theme?: CrmSideoverTheme;
};

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
  theme = "dark",
}: Props) {
  if (!open) return null;

  const isLight = theme === "light";
  const width =
    widthClass ?? (wide ? "max-w-[min(1180px,98vw)]" : "max-w-[48rem]");

  const titleColor = isLight ? RF_LIGHT_TEXT_PRIMARY : RF_TEXT_PRIMARY;
  const kindColor = isLight ? RF_LIGHT_TEXT_SECONDARY : RF_TEXT_SECONDARY;
  const subtitleColor = isLight ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;
  const borderColor = isLight ? RF_LIGHT_BORDER : RF_BORDER;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        style={rfOverlayStyle(120, theme)}
        aria-label="Fechar painel"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative flex h-full w-full flex-col ${width}`}
        style={rfAsideStyle(wide ? "min(1180px, 98vw)" : "min(48rem, 100vw)", 121, theme)}
      >
        <div className="flex-shrink-0 px-6 py-4" style={rfAsideHeaderStyle(theme)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {Icon ? (
                <Icon
                  size={16}
                  style={{ color: RF_ACCENT, marginTop: 2, flexShrink: 0 }}
                />
              ) : null}
              <div className="min-w-0">
                {kindLabel ? (
                  <p
                    className="m-0 text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: kindColor }}
                  >
                    {kindLabel}
                  </p>
                ) : null}
                <h3
                  className="text-base font-bold"
                  style={{ color: titleColor, margin: kindLabel ? "3px 0 0" : 0 }}
                >
                  {title}
                </h3>
                {subtitle ? (
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: subtitleColor }}>
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
                style={rfCloseButtonStyle(theme)}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {headerToolbar ? (
            <div
              className="mt-4 min-w-0"
              style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 14 }}
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
            style={rfAsideFooterStyle(theme)}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function crmRetrofitSideoverFooterBtnCancel(
  onClick: () => void,
  disabled?: boolean,
  theme: CrmSideoverTheme = "dark"
) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl border px-4 text-sm font-medium disabled:opacity-60"
      style={{
        borderColor: isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG,
        color: isLight ? RF_LIGHT_TEXT_SECONDARY : RF_TEXT_SECONDARY,
        background: isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.6)",
      }}
    >
      Cancelar
    </button>
  );
}

export function crmRetrofitSideoverFooterBtnPrimary(
  label: string,
  onClick: () => void,
  disabled?: boolean,
  theme: CrmSideoverTheme = "dark"
) {
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
      style={{
        background: isLight ? "#15803d" : "#0b1f10",
        color: isLight ? "#ffffff" : RF_ACCENT,
      }}
    >
      {label}
    </button>
  );
}
