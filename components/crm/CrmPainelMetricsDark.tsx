"use client";

import type { PainelKpiCard } from "@/lib/crm/painel-tabs";
import { CrmPainelMetricsSkeleton } from "@/components/crm/painel/CrmPainelSkeleton";
import {
  RF_ACCENT,
  RF_BG_CARD,
  RF_BORDER_STRONG,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  kpis: PainelKpiCard[];
  loading?: boolean;
};

const LIME = RF_ACCENT;

const TONE_VALOR: Record<string, string> = {
  brand: LIME,
  success: LIME,
  warning: "#e3b341",
  danger: "#ff7b72",
  muted: RF_TEXT_PRIMARY,
  default: LIME,
};

const TONE_PROGRESS: Record<string, string> = {
  brand: LIME,
  success: LIME,
  warning: "#e3b341",
  danger: "#ff7b72",
  muted: "rgba(146, 255, 0, 0.35)",
  default: LIME,
};

function progressFromKpi(kpi: PainelKpiCard): number {
  const { valor } = kpi;

  if (typeof valor === "string") {
    if (valor.includes("%")) {
      const n = parseFloat(valor.replace("%", "").replace(",", "."));
      return Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
    }
    if (valor.startsWith("R$")) {
      const raw = valor.replace(/[^\d,]/g, "").replace(",", ".");
      const n = parseFloat(raw) || 0;
      if (n <= 0) return 0;
      return Math.min(100, Math.round((n / 250_000) * 100));
    }
  }

  if (typeof valor === "number") {
    if (valor <= 0) return 0;
    return Math.min(100, Math.max(12, Math.round(valor * 15)));
  }

  return 0;
}

function MiniProgressBar({
  pct,
  tone,
}: {
  pct: number;
  tone: string;
}) {
  const fill = TONE_PROGRESS[tone] ?? LIME;
  const width = Math.min(100, Math.max(0, pct));

  return (
    <div
      className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "rgba(146, 255, 0, 0.14)" }}
      aria-hidden
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${width}%`,
          minWidth: width > 0 ? 6 : 0,
          background: fill,
          boxShadow: width > 0 ? `0 0 8px ${fill}66` : undefined,
        }}
      />
    </div>
  );
}

export function CrmPainelMetricsDark({ kpis, loading }: Props) {
  if (kpis.length === 0 && !loading) return null;
  if (loading) return <CrmPainelMetricsSkeleton count={kpis.length || 4} />;

  return (
    <div
      className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      style={{
        borderRadius: 16,
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: RF_BG_CARD,
        padding: 14,
        boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
      }}
    >
      {kpis.map((kpi) => {
        const tone = kpi.tone ?? "default";
        const valorCor = TONE_VALOR[tone] ?? LIME;
        const progress = progressFromKpi(kpi);

        return (
          <div
            key={kpi.key}
            className="overflow-hidden rounded-xl px-3.5 py-3.5"
            style={{
              border: "1px solid rgba(146, 255, 0, 0.28)",
              background: "rgba(11, 31, 16, 0.92)",
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: RF_TEXT_SECONDARY }}
            >
              {kpi.label}
            </p>
            <p
              className="mt-2 text-2xl font-black tabular-nums"
              style={{ color: valorCor }}
            >
              {kpi.valor}
            </p>
            {kpi.sub ? (
              <p className="mt-1 text-[11px] font-medium" style={{ color: RF_TEXT_SECONDARY }}>
                {kpi.sub}
              </p>
            ) : null}
            <MiniProgressBar pct={progress} tone={tone} />
          </div>
        );
      })}
    </div>
  );
}
