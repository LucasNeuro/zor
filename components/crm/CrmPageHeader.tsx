"use client";

import type { CSSProperties, ReactNode } from "react";
import { CrmHeaderActionsRow } from "@/components/crm/CrmHeaderActionsRow";
import { CRM_HEADER_BAR_GRADIENT } from "@/lib/crm-shell-theme";

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
      } as CSSProperties)
    : ({
        background: CRM_HEADER_BAR_GRADIENT,
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "rgba(48, 54, 61, 0.65)",
      } satisfies CSSProperties);

  return (
    <header
      className={`relative z-[12] flex min-h-[4.25rem] flex-shrink-0 items-start justify-between gap-4 border-b px-4 py-3.5 md:min-h-[4.5rem] md:px-6 md:py-4 ${
        blendDesktopUnderlap
          ? "max-md:[background:var(--crm-header-grad)] max-md:[box-shadow:inset_0_-1px_0_rgba(0,0,0,0.22)] md:!border-b-0 md:!bg-transparent md:!shadow-none"
          : ""
      } ${className}`}
      style={barStyle}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-white md:text-xl">{title}</h1>
        {subtitle != null && subtitle !== "" ? (
          <div className="mt-0.5 text-xs leading-snug md:text-sm" style={{ color: "var(--obra-texto-2, #8b949e)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <CrmHeaderActionsRow>{actions}</CrmHeaderActionsRow> : null}
    </header>
  );
}
