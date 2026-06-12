"use client";

import {
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
  RF_TEXT_MUTED,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type LeadSideoverNavId = "timeline" | "dados" | "observacoes" | "conversas" | "conversas_email";

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
  /** Exibe ícone WhatsApp (leads com telefone / origem WhatsApp). */
  showWhatsappTab?: boolean;
  /** Exibe ícone E-mail (leads atendidos via canal e-mail). */
  showEmailTab?: boolean;
};

const NAV_BG = "rgba(6, 13, 8, 0.85)";
const ACTIVE_BG = "rgba(63, 185, 80, 0.14)";

/** Mini sidebar — somente ícones (~48px), padrão drawer de cargos. */
export function LeadSideoverNavRail({
  active,
  onChange,
  observacoesCount = 0,
  showWhatsappTab = true,
  showEmailTab = false,
}: Props) {
  const items: NavItem[] = [
    { id: "timeline", label: "Resumo", icon: LayoutDashboard },
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
        borderRight: `1px solid ${RF_BORDER_STRONG}`,
        background: NAV_BG,
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
                border: isActive ? `1px solid ${RF_ACCENT}` : "1px solid transparent",
                background: isActive ? ACTIVE_BG : "transparent",
                color: isActive ? RF_ACCENT : RF_TEXT_SECONDARY,
                boxShadow: isActive ? "0 2px 8px rgba(146, 255, 0, 0.12)" : undefined,
              }}
            >
              <Icon size={16} strokeWidth={2} />
              {badge != null ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold"
                  style={{
                    background: isActive ? "rgba(146, 255, 0, 0.25)" : "rgba(63, 152, 72, 0.35)",
                    color: isActive ? RF_ACCENT : RF_TEXT_MUTED,
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
