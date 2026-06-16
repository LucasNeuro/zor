"use client";

import type { ReactNode } from "react";
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
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

/** Grupo segmentado — tema escuro (padrão CRM) ou claro (lead / conversas Waje). */
export function CrmSideoverActionGroup({
  children,
  className = "",
  theme = "dark",
}: {
  children: ReactNode;
  className?: string;
  theme?: CrmSideoverTheme;
}) {
  const isLight = theme === "light";
  return (
    <div
      role="group"
      className={`inline-flex max-w-full shrink-0 items-stretch overflow-hidden rounded-lg border ${className}`}
      style={{
        borderColor: isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG,
        background: isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.85)",
        boxShadow: isLight ? "0 1px 2px rgba(11, 34, 16, 0.06)" : "0 1px 2px rgba(0,0,0,0.25)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** Linha única do header — ações + estágios lado a lado, scroll horizontal. */
export function CrmSideoverToolbarRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
      {children}
    </div>
  );
}

/** Linha com scroll horizontal para grupos longos (estágios do funil). */
export function CrmSideoverActionScrollRow({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className || "mb-3"}`}>
      {label ? (
        <p
          className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: RF_TEXT_MUTED }}
        >
          {label}
        </p>
      ) : null}
      <div className="max-w-full overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
}

export function CrmSideoverActionBtn({
  onClick,
  title,
  ariaLabel,
  children,
  active,
  disabled,
  variant = "default",
  theme = "dark",
}: {
  onClick: () => void;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
  theme?: CrmSideoverTheme;
}) {
  const isLight = theme === "light";
  const color =
    variant === "danger"
      ? active
        ? "#dc2626"
        : "#ef4444"
      : active
        ? isLight
          ? "#15803d"
          : RF_ACCENT
        : isLight
          ? RF_LIGHT_TEXT_SECONDARY
          : RF_TEXT_PRIMARY;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 border-l px-3 text-[11px] font-bold first:border-l-0 disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        borderColor: isLight ? RF_LIGHT_BORDER : RF_BORDER_STRONG,
        color,
        background: active
          ? variant === "danger"
            ? "rgba(248, 81, 73, 0.14)"
            : isLight
              ? "#f0fdf4"
              : "rgba(146, 255, 0, 0.12)"
          : "transparent",
      }}
      aria-label={ariaLabel ?? title}
      title={title}
    >
      {children}
    </button>
  );
}

export function CrmSideoverInlinePanel({
  title,
  children,
  tone = "default",
}: {
  title?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  const border =
    tone === "danger" ? "rgba(248, 81, 73, 0.42)" : RF_BORDER_STRONG;
  const bg =
    tone === "danger" ? "rgba(248, 81, 73, 0.08)" : "rgba(6, 13, 8, 0.55)";

  return (
    <div
      className="mb-4 rounded-xl border p-4"
      style={{ borderColor: border, background: bg }}
    >
      {title ? (
        <p
          className="mb-3 text-[11px] font-extrabold uppercase tracking-wide"
          style={{ color: tone === "danger" ? "#f87171" : RF_ACCENT }}
        >
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Abas com underline (padrão original do lead sideover). */
export function CrmSideoverUnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="mb-4 flex overflow-x-auto"
      style={{ borderBottom: `1px solid ${RF_BORDER_STRONG}` }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className="min-w-0 flex-[1_0_auto] cursor-pointer border-none bg-transparent px-2 py-2.5 text-[11px] font-bold whitespace-nowrap"
          style={{
            color: active === t.id ? RF_ACCENT : RF_TEXT_MUTED,
            borderBottom:
              active === t.id ? `2px solid ${RF_ACCENT}` : "2px solid transparent",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Abas como grupo segmentado (mesmo visual dos botões de ação). */
export function CrmSideoverTabGroup<T extends string>({
  tabs,
  active,
  onChange,
  theme = "dark",
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  theme?: CrmSideoverTheme;
}) {
  return (
    <CrmSideoverActionScrollRow label="Conteúdo">
      <CrmSideoverActionGroup className="w-full min-w-max" theme={theme}>
        {tabs.map((t) => (
          <CrmSideoverActionBtn
            key={t.id}
            active={active === t.id}
            onClick={() => onChange(t.id)}
            title={t.label}
            theme={theme}
          >
            {t.label}
          </CrmSideoverActionBtn>
        ))}
      </CrmSideoverActionGroup>
    </CrmSideoverActionScrollRow>
  );
}

export const CRM_SIDEOVER_INPUT =
  "w-full min-h-10 rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[#5d7a67] focus:border-[#92ff00]";

export const CRM_SIDEOVER_INPUT_STYLE = {
  borderColor: RF_BORDER_STRONG,
  background: "rgba(6, 13, 8, 0.85)",
  color: RF_TEXT_PRIMARY,
} as const;

export const CRM_SIDEOVER_LABEL =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#92ff00]";

/** Painel interno para formulários no sideover do lead. */
export function CrmSideoverFormPanel({
  children,
  title = "Dados do lead",
  theme = "dark",
}: {
  children: ReactNode;
  title?: string;
  theme?: CrmSideoverTheme;
}) {
  const isLight = theme === "light";
  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER,
        background: isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.45)",
        boxShadow: isLight ? "0 1px 3px rgba(11, 34, 16, 0.06)" : undefined,
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: isLight ? RF_LIGHT_BORDER : RF_BORDER }}
      >
        <p
          className="m-0 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: isLight ? RF_LIGHT_TEXT_SECONDARY : RF_ACCENT }}
        >
          {title}
        </p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
