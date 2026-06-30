"use client";

import {
  Briefcase,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_LIGHT_BG,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_SECONDARY,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type LeadSideoverNavId =
  | "timeline"
  | "dados"
  | "observacoes"
  | "conversas"
  | "conversas_email"
  | "negocios";

type NavItem = {
  id: LeadSideoverNavId;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type Props = {
  active: LeadSideoverNavId | null;
  onChange: (id: LeadSideoverNavId) => void;
  observacoesCount?: number;
  showWhatsappTab?: boolean;
  showEmailTab?: boolean;
  showNegociosTab?: boolean;
  /** Só Resumo + Negócios (funil vendas sem chat). */
  minimal?: boolean;
  theme?: CrmSideoverTheme;
};

export function LeadSideoverNavRail({
  active,
  onChange,
  observacoesCount = 0,
  showWhatsappTab = true,
  showEmailTab = false,
  showNegociosTab = false,
  minimal = false,
  theme = "light",
}: Props) {
  const isLight = theme === "light";
  const items: NavItem[] = minimal
    ? [
        { id: "timeline", label: "Resumo", icon: LayoutDashboard },
        ...(showNegociosTab
          ? [{ id: "negocios" as const, label: "Negócios", icon: Briefcase }]
          : []),
      ]
    : [
        { id: "timeline", label: "Resumo", icon: LayoutDashboard },
        ...(showNegociosTab
          ? [{ id: "negocios" as const, label: "Negócios", icon: Briefcase }]
          : []),
        { id: "dados", label: "Dados", icon: FileText },
        ...(showWhatsappTab
          ? [{ id: "conversas" as const, label: "WhatsApp", icon: MessageSquare }]
          : []),
        ...(showEmailTab ? [{ id: "conversas_email" as const, label: "E-mail", icon: Mail }] : []),
        {
          id: "observacoes",
          label: "Observações",
          icon: StickyNote,
          badge: observacoesCount > 0 ? observacoesCount : undefined,
        },
      ];

  return (
    <nav
      aria-label="Secções do lead"
      className="flex min-h-0 shrink-0 flex-col"
      style={{
        width: 48,
        borderRight: `1px solid ${isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG}`,
        background: isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.85)",
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5 pt-3">
        {items.map(({ id, label, icon: Icon, badge }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex h-9 w-full items-center justify-center rounded-lg transition-colors"
              style={{
                border: isActive
                  ? `1px solid ${isLight ? "#86efac" : RF_ACCENT}`
                  : "1px solid transparent",
                background: isActive
                  ? isLight
                    ? "#f0fdf4"
                    : "rgba(63, 185, 80, 0.14)"
                  : "transparent",
                color: isActive
                  ? isLight
                    ? "#15803d"
                    : RF_ACCENT
                  : isLight
                    ? RF_LIGHT_TEXT_SECONDARY
                    : RF_TEXT_SECONDARY,
                boxShadow: isActive
                  ? isLight
                    ? "0 1px 3px rgba(11, 34, 16, 0.08)"
                    : "0 2px 8px rgba(146, 255, 0, 0.12)"
                  : undefined,
              }}
            >
              <Icon size={16} strokeWidth={2} />
              {badge != null ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold"
                  style={{
                    background: isActive
                      ? isLight
                        ? "#bbf7d0"
                        : "rgba(146, 255, 0, 0.25)"
                      : isLight
                        ? RF_LIGHT_BG
                        : "rgba(63, 152, 72, 0.35)",
                    color: isActive
                      ? isLight
                        ? "#15803d"
                        : RF_ACCENT
                      : isLight
                        ? RF_LIGHT_TEXT_MUTED
                        : RF_TEXT_MUTED,
                  }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
