"use client";

import type { CSSProperties, ReactNode } from "react";
import { CrmHeaderActionsRow } from "@/components/crm/CrmHeaderActionsRow";
import { CrmSidebarToggleButton } from "@/components/crm/CrmSidebarToggleButton";
import { CRM_CHROME_SOLID, CRM_HEADER_BAR_GRADIENT } from "@/lib/crm-shell-theme";

export type CrmPageHeaderProps = {
  title: string;
  /** Texto ou conteúdo sob o título (contagens, descrição curta, etc.) */
  subtitle?: ReactNode;
  /** Botões / menu à direita */
  actions?: ReactNode;
  className?: string;
  /**
   * No desktop CRM: faixa colorida está num layer full-bleed por baixo da sidebar;
   * este header fica só com o conteúdo (fundo transparente em md+).
   */
  blendDesktopUnderlap?: boolean;
};

/**
 * Faixa superior padrão das páginas do CRM (título + subtítulo + ações).
 * Use em cada `page.tsx` com conteúdo específico; depois pode-se ligar a `usePathname()` + mapa se quiserem defaults por rota.
 */
export function CrmPageHeader({
  title,
  subtitle,
  actions,
  className = "",
  blendDesktopUnderlap = false,
}: CrmPageHeaderProps) {
  const barStyle = blendDesktopUnderlap
    ? ({
        ["--crm-header-grad" as string]: CRM_HEADER_BAR_GRADIENT,
        ["--crm-header-chrome-solid" as string]: CRM_CHROME_SOLID,
      } as CSSProperties)
    : ({
        background: CRM_HEADER_BAR_GRADIENT,
        boxShadow: "inset 0 -1px 0 rgba(16, 47, 34, 0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "rgba(18, 56, 43, 0.14)",
      } satisfies CSSProperties);

  return (
    <header
      className={`relative z-[12] flex min-h-[4.25rem] flex-shrink-0 items-start justify-between gap-3 border-b border-[rgba(18,56,43,0.16)] px-3 py-3.5 md:min-h-[4.5rem] md:items-center md:gap-4 md:border-b md:border-[rgba(18,56,43,0.14)] md:pl-2 md:pr-6 md:py-4 ${
        blendDesktopUnderlap
          ? "max-md:[background:var(--crm-header-grad)] max-md:[box-shadow:inset_0_-1px_0_rgba(18,56,43,0.14)] md:!bg-[var(--crm-header-chrome-solid)] md:!shadow-none"
          : ""
      } ${className}`}
      style={barStyle}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2 md:items-center md:gap-2.5">
        <CrmSidebarToggleButton variant="header" className="mt-0.5 shrink-0 md:mt-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-[#12382b] md:text-xl">{title}</h1>
          {subtitle != null && subtitle !== "" ? (
            <div className="mt-0.5 text-xs leading-snug md:text-sm" style={{ color: "var(--obra-texto-2, #5f7469)" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <CrmHeaderActionsRow>{actions}</CrmHeaderActionsRow> : null}
    </header>
  );
}
