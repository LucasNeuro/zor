"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
  className?: string;
  theme?: "light" | "dark";
};

type PermissionToggleRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  statusLabel?: string;
  disabled?: boolean;
  badge?: ReactNode;
  labelledBy?: string;
  className?: string;
  variant?: "default" | "status";
  theme?: "light" | "dark";
};

function statusTextColor(checked: boolean, disabled: boolean, dark: boolean): string {
  if (dark) {
    if (disabled) return RF_TEXT_MUTED;
    return checked ? RF_ACCENT : RF_TEXT_MUTED;
  }
  if (disabled) return "#9db0a4";
  return checked ? "#1e7a41" : "#96a89e";
}

function rowBorderColor(checked: boolean, disabled: boolean, dark: boolean): string {
  if (dark) return disabled ? RF_BORDER : checked ? RF_BORDER_STRONG : RF_BORDER;
  if (disabled) return "#e7eeea";
  return checked ? "#c2ddc8" : "#e6eeea";
}

function rowStatusBorderColor(checked: boolean, disabled: boolean, dark: boolean): string {
  if (dark) return rowBorderColor(checked, disabled, true);
  if (disabled) return "#e7eeea";
  return checked ? "#b8dfc3" : "#dde6e0";
}

function rowBackgroundColor(
  checked: boolean,
  disabled: boolean,
  dark: boolean,
  isStatus: boolean
): string {
  if (dark) {
    if (disabled) return "rgba(6, 13, 8, 0.55)";
    if (isStatus) return checked ? "rgba(11, 31, 16, 0.92)" : "rgba(6, 13, 8, 0.75)";
    return checked ? "rgba(11, 31, 16, 0.88)" : "rgba(6, 13, 8, 0.72)";
  }
  if (disabled) return "#fbfcfb";
  return isStatus ? (checked ? "#f0faf3" : "#fafafa") : "#fff";
}

function iconBackgroundColor(checked: boolean, disabled: boolean, dark: boolean): string {
  if (dark) {
    if (disabled) return "rgba(6, 13, 8, 0.6)";
    return checked ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.85)";
  }
  if (disabled) return "#f5f8f6";
  return checked ? "#eef7f1" : "#f4f7f5";
}

function iconStatusBackgroundColor(checked: boolean, disabled: boolean, dark: boolean): string {
  return iconBackgroundColor(checked, disabled, dark);
}

function iconColor(checked: boolean, disabled: boolean, dark: boolean): string {
  if (dark) {
    if (disabled) return RF_TEXT_MUTED;
    return checked ? RF_ACCENT : RF_TEXT_SECONDARY;
  }
  if (disabled) return "#aac0b2";
  return checked ? "#1e7a41" : "#7fa08a";
}

function iconBorderColor(dark: boolean): string {
  return dark ? RF_BORDER_STRONG : "#d6e7da";
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  labelledBy,
  className = "",
  theme = "light",
}: ToggleSwitchProps) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 ${dark ? "focus-visible:ring-[#92ff00]/40" : "focus-visible:ring-[#c9a24a]/50"} focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`.trim()}
      style={{
        width: 52,
        background: dark ? (checked ? "#0b1f10" : "#3f9848") : checked ? "#0f6b4f" : "#c8d8cc",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? "translateX(28px)" : "translateX(3px)" }}
      />
    </button>
  );
}

export function PermissionToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  statusLabel,
  disabled = false,
  badge,
  labelledBy,
  className = "",
  variant = "default",
  theme = "light",
}: PermissionToggleRowProps) {
  const isStatus = variant === "status";
  const dark = theme === "dark";
  return (
    <div
      className={`flex items-center gap-4 rounded-xl p-4 transition-colors ${className}`.trim()}
      style={{
        background: rowBackgroundColor(checked, disabled, dark, isStatus),
        border: `1px solid ${isStatus ? rowStatusBorderColor(checked, disabled, dark) : rowBorderColor(checked, disabled, dark)}`,
      }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isStatus
            ? iconStatusBackgroundColor(checked, disabled, dark)
            : iconBackgroundColor(checked, disabled, dark),
          border: `1px solid ${iconBorderColor(dark)}`,
        }}
      >
        <Icon size={18} strokeWidth={1.75} style={{ color: iconColor(checked, disabled, dark) }} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            id={labelledBy}
            className="text-sm font-semibold"
            style={{ color: disabled ? (dark ? RF_TEXT_MUTED : "#617a6d") : dark ? RF_TEXT_PRIMARY : "#0b2210" }}
          >
            {title}
          </p>
          {badge ? <span className="inline-flex items-center">{badge}</span> : null}
        </div>
        <p
          className="mt-0.5 text-xs leading-snug"
          style={{ color: disabled ? (dark ? RF_TEXT_MUTED : "#8aa092") : dark ? RF_TEXT_SECONDARY : "#6b8a76" }}
        >
          {description}
        </p>
      </div>

      <div className="flex flex-shrink-0 flex-col items-center gap-1">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: statusTextColor(checked, disabled, dark) }}
        >
          {statusLabel ?? (checked ? "Ativo" : "Inativo")}
        </span>
        <ToggleSwitch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          labelledBy={labelledBy}
          theme={theme}
        />
      </div>
    </div>
  );
}

export type { PermissionToggleRowProps, ToggleSwitchProps };
