"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
  className?: string;
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
};

function statusTextColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#9db0a4";
  return checked ? "#1e7a41" : "#96a89e";
}

function rowBorderColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#e7eeea";
  return checked ? "#c2ddc8" : "#e6eeea";
}

function rowStatusBorderColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#e7eeea";
  return checked ? "#b8dfc3" : "#dde6e0";
}

function iconBackgroundColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#f5f8f6";
  return checked ? "#eef7f1" : "#f4f7f5";
}

function iconStatusBackgroundColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#f5f8f6";
  return checked ? "#e4f5ea" : "#f0f4f2";
}

function iconColor(checked: boolean, disabled: boolean): string {
  if (disabled) return "#aac0b2";
  return checked ? "#1e7a41" : "#7fa08a";
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  labelledBy,
  className = "",
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`.trim()}
      style={{
        width: 52,
        background: checked ? "#0f6b4f" : "#c8d8cc",
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
}: PermissionToggleRowProps) {
  const isStatus = variant === "status";
  return (
    <div
      className={`flex items-center gap-4 rounded-xl p-4 transition-colors ${className}`.trim()}
      style={{
        background: disabled ? "#fbfcfb" : isStatus ? (checked ? "#f0faf3" : "#fafafa") : "#fff",
        border: `1px solid ${isStatus ? rowStatusBorderColor(checked, disabled) : rowBorderColor(checked, disabled)}`,
      }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: isStatus ? iconStatusBackgroundColor(checked, disabled) : iconBackgroundColor(checked, disabled),
          border: `1px solid ${isStatus ? "#cce0d4" : "#d6e7da"}`,
        }}
      >
        <Icon size={18} strokeWidth={1.75} style={{ color: iconColor(checked, disabled) }} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p id={labelledBy} className="text-sm font-semibold" style={{ color: disabled ? "#617a6d" : "#0b2210" }}>
            {title}
          </p>
          {badge ? <span className="inline-flex items-center">{badge}</span> : null}
        </div>
        <p className="mt-0.5 text-xs leading-snug" style={{ color: disabled ? "#8aa092" : "#6b8a76" }}>
          {description}
        </p>
      </div>

      <div className="flex flex-shrink-0 flex-col items-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: statusTextColor(checked, disabled) }}>
          {statusLabel ?? (checked ? "Ativo" : "Inativo")}
        </span>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} labelledBy={labelledBy} />
      </div>
    </div>
  );
}

export type { PermissionToggleRowProps, ToggleSwitchProps };
