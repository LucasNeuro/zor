"use client";

import type { ReactNode } from "react";
import {
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

const LIME = "#92ff00";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  highlight?: boolean;
};

export function CrmPainelChartShell({
  title,
  subtitle,
  children,
  className,
  action,
  highlight,
}: Props) {
  return (
    <div
      className={`flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl px-4 py-4 ${className ?? ""}`}
      style={{
        border: highlight
          ? "1px solid rgba(146, 255, 0, 0.35)"
          : "1px solid rgba(146, 255, 0, 0.1)",
        background:
          "linear-gradient(155deg, rgba(16, 36, 20, 0.92) 0%, rgba(6, 13, 8, 0.98) 55%, rgba(4, 10, 6, 1) 100%)",
        boxShadow: highlight
          ? "0 8px 40px rgba(146, 255, 0, 0.08), 0 4px 24px rgba(0,0,0,0.45)"
          : "0 4px 28px rgba(0,0,0,0.38)",
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide" style={{ color: RF_TEXT_PRIMARY }}>
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[10px] leading-snug" style={{ color: RF_TEXT_SECONDARY }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export { LIME as PAINEL_LIME };
