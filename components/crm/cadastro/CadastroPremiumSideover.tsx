"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";

type Props = {
  open: boolean;
  onClose: () => void;
  kindLabel: string;
  title: string;
  badge?: ReactNode;
  subtitle?: string;
  Icon: LucideIcon;
  accent?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function CadastroPremiumSideover({
  open,
  onClose,
  kindLabel,
  title,
  badge,
  subtitle,
  Icon,
  accent = "#c9a24a",
  footer,
  children,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 210,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(640px, 100vw)",
          zIndex: 211,
          background: "#0f1620",
          borderLeft: "1px solid #2d394b",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #2d394b",
            padding: 16,
            background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
              <CrmBotRingAvatar
                accent={accent}
                progress={0.75}
                fallbackProgress={0.35}
                pixelSize={52}
                Icon={Icon}
              />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  {kindLabel}
                </p>
                <h3 style={{ margin: "3px 0 0", color: "#e6edf3", fontSize: 17, wordBreak: "break-word" }}>
                  {title}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {badge}
                  {subtitle ? (
                    <span style={{ fontSize: 11, color: "#7f90a8" }}>{subtitle}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                border: "1px solid #344256",
                background: "#1d2633",
                color: "#9eb0c8",
                borderRadius: 8,
                width: 34,
                height: 34,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>{children}</div>

        {footer ? (
          <div
            style={{
              flexShrink: 0,
              padding: "14px 20px",
              borderTop: "1px solid #2d394b",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
              background: "#0d1117",
            }}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}

export function CadastroSideoverPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "#141d29",
        border: "1px solid #2c384b",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(37, 48, 66, 0.9)" }}>
        <p style={{ color: "#8ea1ba", fontSize: 11, margin: 0, fontWeight: 700 }}>Visão do cadastro</p>
        <p style={{ margin: "8px 0 0", color: "#9cb0c9", fontSize: 11, lineHeight: 1.5 }}>
          Dados consolidados do registo no CRM. Alterações em modo edição são auditadas.
        </p>
      </div>
      <div style={{ padding: "6px 14px 12px" }}>{children}</div>
    </div>
  );
}

export function CadastroTipoBadge({ label, tone = "gold" }: { label: string; tone?: "gold" | "green" | "muted" }) {
  const styles =
    tone === "green"
      ? { bg: "rgba(34, 197, 94, 0.15)", fg: "#86efac", border: "rgba(34, 197, 94, 0.35)" }
      : tone === "muted"
        ? { bg: "rgba(100, 116, 139, 0.2)", fg: "#94a3b8", border: "rgba(100, 116, 139, 0.35)" }
        : { bg: "rgba(201, 162, 74, 0.12)", fg: "#d6b976", border: "rgba(201, 162, 74, 0.35)" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: "4px 10px",
        borderRadius: 999,
        background: styles.bg,
        color: styles.fg,
        border: `1px solid ${styles.border}`,
      }}
    >
      {label}
    </span>
  );
}
