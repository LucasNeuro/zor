"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

const ROW_BG = "rgba(6, 13, 8, 0.55)";
const ROW_BORDER = "rgba(146, 255, 0, 0.12)";
const ICON_BG = "rgba(146, 255, 0, 0.08)";

export function WajeOwnerSectionHeading({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <p
      style={{
        color: RF_TEXT_SECONDARY,
        fontSize: 11,
        fontWeight: 700,
        margin: "20px 0 10px",
        letterSpacing: 0.06,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {Icon ? <Icon size={14} style={{ color: RF_ACCENT }} aria-hidden /> : null}
      {children}
    </p>
  );
}

type CardProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  active?: boolean;
  statusLabel?: string;
  statusActive?: boolean;
  right?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
};

export function WajeOwnerRetrofitCard({
  icon: Icon,
  title,
  description,
  active = false,
  statusLabel,
  statusActive,
  right,
  children,
  style,
}: CardProps) {
  const ligado = statusActive ?? active;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: children ? 12 : 0,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${ligado ? "rgba(146,255,0,0.28)" : ROW_BORDER}`,
        background: ligado ? "rgba(146,255,0,0.06)" : ROW_BG,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: ligado ? "rgba(146,255,0,0.18)" : ICON_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: ligado ? RF_ACCENT : "#5d7a67",
            marginTop: 2,
          }}
        >
          <Icon size={21} strokeWidth={2} aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ color: RF_TEXT_PRIMARY, fontSize: 13, fontWeight: 700 }}>{title}</span>
          </div>
          {description ? (
            <span
              style={{
                display: "block",
                color: RF_TEXT_SECONDARY,
                fontSize: 12,
                lineHeight: 1.45,
                marginTop: 4,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>
        {statusLabel || right ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              flexShrink: 0,
              paddingTop: 4,
            }}
          >
            {statusLabel ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: ligado ? "#3fb950" : RF_TEXT_MUTED,
                }}
              >
                {statusLabel}
              </span>
            ) : null}
            {right}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function WajeOwnerActionBtn({
  children,
  onClick,
  disabled,
  variant = "outline",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger";
}) {
  const bg =
    variant === "primary" ? RF_ACCENT : variant === "danger" ? "transparent" : "transparent";
  const color =
    variant === "primary" ? "#0b1f10" : variant === "danger" ? "#f85149" : RF_TEXT_SECONDARY;
  const border =
    variant === "primary"
      ? "none"
      : variant === "danger"
        ? "1px solid rgba(248,81,73,0.35)"
        : `1px solid ${RF_BORDER}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: 8,
        border,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        padding: "6px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}
