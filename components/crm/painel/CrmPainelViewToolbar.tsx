"use client";

import { BarChart3, LayoutGrid, RefreshCw, Table2 } from "lucide-react";
import {
  ANALYTICS_PERIODOS,
  type AnalyticsPeriodo,
  periodoLabel,
} from "@/lib/crm/analytics-period";
import type { PainelViewMode } from "@/lib/crm/painel-view";
import { PAINEL_LIME } from "@/components/crm/painel/CrmPainelChartShell";
import { RF_TEXT_PRIMARY, RF_TEXT_SECONDARY } from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  description: string;
  viewMode: PainelViewMode;
  onViewModeChange: (mode: PainelViewMode) => void;
  showViewToggle: boolean;
  periodo: AnalyticsPeriodo;
  onPeriodoChange: (p: AnalyticsPeriodo) => void;
  showPeriodo: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  dark?: boolean;
};

export function CrmPainelViewToolbar({
  description,
  viewMode,
  onViewModeChange,
  showViewToggle,
  periodo,
  onPeriodoChange,
  showPeriodo,
  onRefresh,
  refreshing,
  dark = false,
}: Props) {
  const textMuted = dark ? RF_TEXT_SECONDARY : "#5d7a67";
  const chipBg = dark ? "rgba(146, 255, 0, 0.06)" : "#eef7eb";
  const chipBorder = dark ? "rgba(146,255,0,0.14)" : "#dcebd8";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef5ec] px-4 py-3">
      <p className="max-w-xl text-[11px] leading-relaxed" style={{ color: textMuted }}>
        {description}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showViewToggle ? (
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: chipBg, border: `1px solid ${chipBorder}` }}
          >
            <ViewBtn
              active={viewMode === "paineis"}
              onClick={() => onViewModeChange("paineis")}
              icon={<LayoutGrid size={12} />}
              label="Painéis"
              dark={dark}
            />
            <ViewBtn
              active={viewMode === "tabela"}
              onClick={() => onViewModeChange("tabela")}
              icon={<Table2 size={12} />}
              label="Tabela"
              dark={dark}
            />
          </div>
        ) : null}

        {showPeriodo && viewMode === "paineis" ? (
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: chipBg, border: `1px solid ${chipBorder}` }}
          >
            {ANALYTICS_PERIODOS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onPeriodoChange(p.value)}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all"
                style={{
                  background: periodo === p.value ? (dark ? "rgba(146, 255, 0, 0.2)" : "#dcebd8") : "transparent",
                  color: periodo === p.value ? (dark ? PAINEL_LIME : "#0b2210") : textMuted,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}

        {showPeriodo && viewMode === "paineis" ? (
          <span className="hidden text-[9px] sm:inline" style={{ color: textMuted }}>
            <BarChart3 size={10} className="mr-0.5 inline" />
            {periodoLabel(periodo)}
          </span>
        ) : null}

        {onRefresh && viewMode === "paineis" ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-50"
            style={{
              border: `1px solid ${chipBorder}`,
              color: textMuted,
            }}
            title="Atualizar painéis"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
  dark,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  dark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all"
      style={{
        background: active ? PAINEL_LIME : "transparent",
        color: active ? "#060d08" : dark ? RF_TEXT_PRIMARY : "#0b2210",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
