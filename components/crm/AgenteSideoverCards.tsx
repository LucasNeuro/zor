"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot } from "lucide-react";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import {
  RF_ACCENT,
  RF_BG_CARD,
  RF_BORDER_STRONG,
  RF_TEXT_DIM,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export const AGENTE_CARD_SHELL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: RF_BG_CARD,
  border: `1px solid ${RF_BORDER_STRONG}`,
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(146, 255, 0, 0.06) inset",
};

export const AGENTE_CARD_SHELL_LIGHT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "#ffffff",
  border: "1px solid rgba(18, 56, 43, 0.14)",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 6px 20px rgba(15, 56, 39, 0.07)",
};

export type AgenteCardTheme = "light" | "dark";

export const AGENTE_CARD_THEME_TOKENS = {
  dark: {
    shell: AGENTE_CARD_SHELL,
    footerBg: "rgba(4, 10, 6, 0.72)",
    footerBorder: RF_BORDER_STRONG,
    caption: RF_TEXT_MUTED,
    captionDim: RF_TEXT_DIM,
  },
  light: {
    shell: AGENTE_CARD_SHELL_LIGHT,
    footerBg: "#f8fcf6",
    footerBorder: "rgba(18, 56, 43, 0.1)",
    caption: "#4a6356",
    captionDim: "#6b8a76",
  },
} as const;

type EntityCardProps = {
  accent?: string;
  imageUrl?: string | null;
  /** Slug do agente — mesmo retrato Notionists que no cabeçalho. */
  avatarSeed?: string;
  avatarNome?: string | null;
  Icon?: LucideIcon;
  progress?: number | null;
  fallbackProgress?: number;
  pulse?: boolean;
  dim?: boolean;
  avatarCaption?: string;
  footer?: ReactNode;
  children: ReactNode;
  theme?: AgenteCardTheme;
};

export function AgenteSideoverEntityCard({
  accent = RF_ACCENT,
  imageUrl,
  avatarSeed,
  avatarNome,
  Icon = Bot,
  progress,
  fallbackProgress = 0.35,
  pulse = false,
  dim = false,
  avatarCaption,
  footer,
  children,
  theme = "dark",
}: EntityCardProps) {
  const tokens = AGENTE_CARD_THEME_TOKENS[theme];
  return (
    <div style={tokens.shell}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 14px 12px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            width: 62,
          }}
        >
          <CrmBotRingAvatar
            accent={accent}
            progress={progress}
            fallbackProgress={fallbackProgress}
            pixelSize={58}
            imageUrl={imageUrl}
            avatarSeed={avatarSeed}
            avatarNome={avatarNome}
            Icon={Icon}
            dim={dim}
            pulse={pulse}
          />
          {avatarCaption ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: dim ? tokens.captionDim : tokens.caption,
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 62,
              }}
            >
              {avatarCaption}
            </span>
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
      {footer ? (
        <div
          style={{
            borderTop: `1px solid ${tokens.footerBorder}`,
            padding: "11px 14px 12px",
            background: tokens.footerBg,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

type InfoGridItem = { label: string; value: ReactNode };

export function AgenteSideoverInfoGrid({ rows }: { rows: InfoGridItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: "6px 16px",
        fontSize: 11,
        color: RF_TEXT_MUTED,
        lineHeight: 1.45,
      }}
    >
      {rows.map((row) => (
        <span key={row.label} style={{ display: "contents" }}>
          <span style={{ color: RF_TEXT_DIM, fontWeight: 600 }}>{row.label}</span>
          <span style={{ color: RF_TEXT_SECONDARY, minWidth: 0 }}>{row.value}</span>
        </span>
      ))}
    </div>
  );
}
