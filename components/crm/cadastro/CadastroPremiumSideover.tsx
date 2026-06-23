"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import { CrmSideoverLoadingState } from "@/components/crm/CrmSideoverLoadingState";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideBodyStyle,
  rfAsideFooterStyle,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfInnerPanelStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

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
  loading?: boolean;
  loadingLabel?: string;
};

export function CadastroPremiumSideover({
  open,
  onClose,
  kindLabel,
  title,
  badge,
  subtitle,
  Icon,
  accent = RF_ACCENT,
  footer,
  children,
  loading = false,
  loadingLabel = "A carregar…",
}: Props) {
  if (!open) return null;

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(210)} />
      <aside role="dialog" aria-modal="true" style={rfAsideStyle("min(48rem, 100vw)", 211)}>
        <div style={rfAsideHeaderStyle()}>
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
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  {kindLabel}
                </p>
                <h3 style={{ margin: "3px 0 0", color: RF_TEXT_PRIMARY, fontSize: 17, wordBreak: "break-word" }}>
                  {title}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {badge}
                  {subtitle ? (
                    <span style={{ fontSize: 11, color: RF_TEXT_MUTED }}>{subtitle}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div style={rfAsideBodyStyle()}>
          {loading ? <CrmSideoverLoadingState label={loadingLabel} centered /> : children}
        </div>

        {footer ? <div style={rfAsideFooterStyle()}>{footer}</div> : null}
      </aside>
    </>
  );
}

export function CadastroSideoverPanel({ children }: { children: ReactNode }) {
  return (
    <div style={rfInnerPanelStyle()}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
        <p style={{ color: RF_ACCENT, fontSize: 11, margin: 0, fontWeight: 700 }}>Visão do cadastro</p>
        <p style={{ margin: "8px 0 0", color: RF_TEXT_SECONDARY, fontSize: 11, lineHeight: 1.5 }}>
          Dados consolidados do registo no CRM. Alterações em modo edição são auditadas.
        </p>
      </div>
      <div style={{ padding: "6px 14px 12px" }}>{children}</div>
    </div>
  );
}

export function CadastroTipoBadge({ label, tone = "green" }: { label: string; tone?: "gold" | "green" | "muted" }) {
  const styles =
    tone === "green"
      ? { bg: "rgba(146, 255, 0, 0.12)", fg: RF_ACCENT, border: RF_BORDER_STRONG }
      : tone === "muted"
        ? { bg: "rgba(6, 13, 8, 0.6)", fg: RF_TEXT_MUTED, border: RF_BORDER }
        : { bg: "rgba(146, 255, 0, 0.12)", fg: RF_ACCENT, border: RF_BORDER_STRONG };
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
