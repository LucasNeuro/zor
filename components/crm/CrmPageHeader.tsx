"use client";

import type { CSSProperties, ReactNode } from "react";
import { CrmHeaderActionsRow } from "@/components/crm/CrmHeaderActionsRow";
import { CRM_CHROME_ROW_HEIGHT_PX, CRM_CHROME_SOLID, CRM_HEADER_BAR_GRADIENT } from "@/lib/crm-shell-theme";

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
      className={`relative z-[12] flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#e8f0e6] px-3 py-3.5 max-md:min-h-[4.25rem] max-md:items-start md:h-[var(--crm-chrome-row-h)] md:min-h-[var(--crm-chrome-row-h)] md:justify-end md:gap-4 md:px-6 md:py-0 ${
        blendDesktopUnderlap
          ? "max-md:[background:var(--crm-header-grad)] max-md:[box-shadow:inset_0_-1px_0_rgba(18,56,43,0.14)] md:!bg-[var(--crm-header-chrome-solid)] md:!shadow-none"
          : ""
      } ${className}`}
      style={{
        ...barStyle,
        ["--crm-chrome-row-h" as string]: `${CRM_CHROME_ROW_HEIGHT_PX}px`,
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2 max-md:items-center md:ml-auto md:flex-none md:items-center md:justify-end md:gap-4">
        <div className="min-w-0 max-md:flex-1 md:text-right">
          <h1 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-[#12382b] md:text-xl">
            {title}
          </h1>
          {subtitle != null && subtitle !== "" ? (
            <div
              className="mt-0.5 text-xs leading-snug md:text-sm"
              style={{ color: "var(--obra-texto-2, #5f7469)" }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <CrmHeaderActionsRow>{actions}</CrmHeaderActionsRow> : null}
      </div>
    </header>
  );
}
