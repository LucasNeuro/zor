"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot } from "lucide-react";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";

export const AGENTE_CARD_SHELL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "linear-gradient(165deg, rgba(22, 30, 44, 0.95) 0%, rgba(12, 17, 24, 0.98) 100%)",
  border: "1px solid rgba(56, 74, 102, 0.55)",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255,255,255,0.03) inset",
};

type EntityCardProps = {
  accent?: string;
  imageUrl?: string | null;
  Icon?: LucideIcon;
  progress?: number | null;
  fallbackProgress?: number;
  pulse?: boolean;
  dim?: boolean;
  avatarCaption?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AgenteSideoverEntityCard({
  accent = "#c9a24a",
  imageUrl,
  Icon = Bot,
  progress,
  fallbackProgress = 0.35,
  pulse = false,
  dim = false,
  avatarCaption,
  footer,
  children,
}: EntityCardProps) {
  return (
    <div style={AGENTE_CARD_SHELL}>
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
            Icon={Icon}
            dim={dim}
            pulse={pulse}
          />
          {avatarCaption ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: dim ? "#475569" : "#7f90a8",
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
            borderTop: "1px solid rgba(37, 48, 66, 0.95)",
            padding: "11px 14px 12px",
            background: "rgba(6, 10, 16, 0.72)",
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
        color: "#94a3b8",
        lineHeight: 1.45,
      }}
    >
      {rows.map((row) => (
        <span key={row.label} style={{ display: "contents" }}>
          <span style={{ color: "#64748b", fontWeight: 600 }}>{row.label}</span>
          <span style={{ color: "#c8d4e6", minWidth: 0 }}>{row.value}</span>
        </span>
      ))}
    </div>
  );
}
