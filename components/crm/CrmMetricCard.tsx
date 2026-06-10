"use client";

import type { ReactNode, MouseEvent } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  CRM_METRIC,
  crmMetricAccentColor,
  crmMetricSparklineBarColor,
  crmMetricValueColor,
  type CrmMetricTone,
} from "@/lib/crm/crm-metric-theme";

export type CrmMetricTrend = {
  label: string;
  positive?: boolean;
};

export type CrmMetricProgress = {
  value: number;
  max: number;
  hint?: string;
};

type Props = {
  label: string;
  valor: string | number;
  sub?: string;
  /** @deprecated Prefira `tone` — cores são normalizadas para a paleta Waje. */
  cor?: string;
  tone?: CrmMetricTone;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  trend?: CrmMetricTrend;
  sparkline?: number[];
  progress?: CrmMetricProgress;
};

function MiniSparkline({ data, accent }: { data: number[]; accent: string }) {
  const bars = data.length ? data : [0.3, 0.5, 0.4, 0.7, 0.45];
  return (
    <div
      className="flex h-9 shrink-0 items-end gap-[3px]"
      aria-hidden
      style={{ minWidth: 52 }}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[7px] rounded-sm transition-all"
          style={{
            height: `${Math.round(h * 100)}%`,
            background: crmMetricSparklineBarColor(accent, i, bars.length),
          }}
        />
      ))}
    </div>
  );
}

function MiniProgress({ progress, accent }: { progress: CrmMetricProgress; accent: string }) {
  const max = Math.max(progress.max, 1);
  const pct = Math.min(100, Math.round((progress.value / max) * 100));
  return (
    <div className="mt-2 w-full">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: CRM_METRIC.track }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      {progress.hint ? (
        <p className="mt-1 flex justify-between text-[10px]" style={{ color: CRM_METRIC.sub }}>
          <span>{progress.hint}</span>
          <span>{pct}%</span>
        </p>
      ) : null}
    </div>
  );
}

export function CrmMetricCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border bg-white p-4 ${className}`}
      style={{ borderColor: CRM_METRIC.border }}
      aria-hidden
    >
      <div className="mb-3 flex justify-between">
        <div className="h-3 w-24 rounded" style={{ background: CRM_METRIC.track }} />
        <div className="h-3 w-10 rounded" style={{ background: CRM_METRIC.track }} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="h-8 w-16 rounded" style={{ background: CRM_METRIC.border }} />
        <div className="flex h-9 gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-full w-[7px] rounded-sm" style={{ background: CRM_METRIC.track }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CrmMetricCard({
  label,
  valor,
  sub,
  cor,
  tone = "default",
  href,
  onClick,
  loading,
  className = "",
  trend,
  sparkline,
  progress,
}: Props) {
  if (loading) return <CrmMetricCardSkeleton className={className} />;

  const accent = crmMetricAccentColor(tone, cor);
  const valueColor = crmMetricValueColor(tone, valor, cor);

  const inner = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold" style={{ color: CRM_METRIC.label }}>
          {label}
        </p>
        {trend ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold tabular-nums"
            style={{
              color: trend.positive !== false ? CRM_METRIC.trendUp : CRM_METRIC.trendDown,
            }}
          >
            {trend.positive !== false ? (
              <TrendingUp size={11} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={11} strokeWidth={2.5} />
            )}
            {trend.label}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="m-0 text-2xl font-extrabold tabular-nums tracking-tight sm:text-[26px]"
            style={{ color: valueColor }}
          >
            {valor}
          </p>
          {sub && !progress ? (
            <p className="m-0 mt-0.5 text-[11px]" style={{ color: CRM_METRIC.sub }}>
              {sub}
            </p>
          ) : null}
        </div>
        {sparkline && !progress ? <MiniSparkline data={sparkline} accent={accent} /> : null}
      </div>

      {progress ? <MiniProgress progress={progress} accent={accent} /> : null}
    </>
  );

  const baseClass =
    `w-full rounded-2xl border bg-white p-4 text-left shadow-[0_1px_3px_rgba(11,31,16,0.06)] transition-[border-color,box-shadow] hover:shadow-[0_4px_12px_rgba(11,31,16,0.08)] ${className}`;

  const cardStyle = {
    borderColor: CRM_METRIC.border,
  };

  const hoverHandlers = {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.style.borderColor = CRM_METRIC.borderHover;
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.style.borderColor = CRM_METRIC.border;
    },
  };

  if (href) {
    return (
      <a
        href={href}
        className={`${baseClass} block no-underline`}
        style={cardStyle}
        {...hoverHandlers}
      >
        {inner}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass} style={cardStyle} {...hoverHandlers}>
        {inner}
      </button>
    );
  }

  return (
    <div className={baseClass} style={cardStyle}>
      {inner}
    </div>
  );
}

export function CrmMetricsGrid({
  children,
  className = "",
  cols = 4,
}: {
  children: ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  const gridClass =
    cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";

  return <div className={`grid gap-3 ${gridClass} ${className}`.trim()}>{children}</div>;
}

export function CrmSectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <p
        className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: CRM_METRIC.label }}
      >
        {children}
      </p>
      <span
        className="h-px flex-1 bg-gradient-to-r from-[#d4e0d7] to-transparent"
        aria-hidden
      />
    </div>
  );
}
