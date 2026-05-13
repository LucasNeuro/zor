"use client";

import type { ReactNode } from "react";
import { CrmHeaderActionsRow } from "@/components/crm/CrmHeaderActionsRow";

const HEADER_SURFACE =
  "sticky top-0 z-20 flex-shrink-0 border-b border-[#30363d]/90 bg-[#161b22]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#161b22]/88 shadow-[inset_0_-1px_0_0_rgba(201,162,74,0.12)]";

type CrmStickyPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Toolbar / primary actions (stacked on narrow screens via parent flex-col) */
  actions?: ReactNode;
  className?: string;
};

/**
 * CRM page title strip: Obra10 dark surface, gold edge hint, stays visible while the layout scroll area moves.
 */
export function CrmStickyPageHeader({ title, description, actions, className = "" }: CrmStickyPageHeaderProps) {
  return (
    <header className={`${HEADER_SURFACE} px-3 py-3 sm:px-5 sm:py-3.5 ${className}`.trim()}>
      <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between min-[480px]:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-base sm:text-lg font-black tracking-tight text-[#e6edf3]">{title}</div>
          {description != null && <div className="mt-0.5 text-xs text-[#8b949e]">{description}</div>}
        </div>
        {actions != null && (
          <div className="flex w-full min-w-0 flex-col gap-2 min-[480px]:w-auto min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
            <CrmHeaderActionsRow>{actions}</CrmHeaderActionsRow>
          </div>
        )}
      </div>
    </header>
  );
}
