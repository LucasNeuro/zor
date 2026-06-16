"use client";

import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { periodoLabel } from "@/lib/crm/analytics-period";
import { PAINEL_LIME } from "@/components/crm/painel/CrmPainelChartShell";
import { RF_TEXT_PRIMARY, RF_TEXT_SECONDARY } from "@/lib/crm/crm-retrofit-dark-theme";

export type ChartBarItem = {
  label: string;
  count: number;
  color?: string;
};

export type EntradaPonto = { dia: string; label: string; count: number };

const LIME_SHADES = [
  PAINEL_LIME,
  "#b8ff33",
  "#7de600",
  "#d4ff66",
  "#5fcc00",
  "#a8f020",
  "#c8ff40",
  "#68e600",
];

function limeForIndex(i: number): string {
  return LIME_SHADES[i % LIME_SHADES.length]!;
}

function agruparPorSemana(pontos: EntradaPonto[]): EntradaPonto[] {
  const semanas = new Map<string, EntradaPonto>();
  for (const p of pontos) {
    const d = new Date(`${p.dia}T12:00:00`);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const key = monday.toISOString().slice(0, 10);
    const label = `Sem. ${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    const cur = semanas.get(key);
    if (cur) cur.count += p.count;
    else semanas.set(key, { dia: key, label, count: p.count });
  }
  return [...semanas.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

export function FunilBarChartDark({ items }: { items: ChartBarItem[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  if (items.every((i) => i.count === 0)) {
    return (
      <p className="py-10 text-center text-xs" style={{ color: RF_TEXT_SECONDARY }}>
        Sem registros neste funil.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const pct = Math.round((item.count / max) * 100);
        const fill = item.color ?? limeForIndex(i);
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="min-w-[5rem] shrink-0 truncate text-right text-[10px] font-medium sm:min-w-[6.5rem]"
              style={{ color: RF_TEXT_SECONDARY }}
              title={item.label}
            >
              {item.label}
            </span>
            <div
              className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full"
              style={{ background: "rgba(146, 255, 0, 0.1)" }}
            >
              {item.count > 0 ? (
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(8, pct)}%`,
                    background: fill,
                    boxShadow: `0 0 10px ${fill}55`,
                  }}
                />
              ) : null}
            </div>
            <span
              className="w-6 shrink-0 text-right text-[10px] font-bold tabular-nums"
              style={{ color: RF_TEXT_PRIMARY }}
            >
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Gráfico de área com glow — estilo fintech. */
export function AreaChartDark({
  pontos,
  periodo,
}: {
  pontos: EntradaPonto[];
  periodo: AnalyticsPeriodo;
}) {
  const exibir = periodo === "30d" ? agruparPorSemana(pontos) : pontos;
  const total = exibir.reduce((s, p) => s + p.count, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-xs" style={{ color: RF_TEXT_SECONDARY }}>
        Sem dados em {periodoLabel(periodo).toLowerCase()}.
      </p>
    );
  }

  const w = 280;
  const h = 100;
  const pad = 4;
  const max = Math.max(1, ...exibir.map((p) => p.count));
  const step = exibir.length > 1 ? (w - pad * 2) / (exibir.length - 1) : 0;

  const coords = exibir.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - (p.count / max) * (h - pad * 2),
    count: p.count,
  }));

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <div>
      <p className="mb-2 text-2xl font-black tabular-nums" style={{ color: PAINEL_LIME }}>
        {total}
        <span className="ml-1.5 text-[10px] font-semibold" style={{ color: RF_TEXT_SECONDARY }}>
          no período
        </span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PAINEL_LIME} stopOpacity="0.45" />
            <stop offset="100%" stopColor={PAINEL_LIME} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" />
        <path
          d={linePath}
          fill="none"
          stroke={PAINEL_LIME}
          strokeWidth="2"
          filter="url(#glow)"
        />
      </svg>
      {exibir.length <= 8 ? (
        <div className="mt-1 flex justify-between gap-0.5">
          {exibir.map((p) => (
            <span
              key={p.dia}
              className="truncate text-[8px]"
              style={{ color: RF_TEXT_SECONDARY }}
              title={`${p.label}: ${p.count}`}
            >
              {p.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Donut — distribuição do funil. */
export function DonutChartDark({
  items,
  centerLabel,
}: {
  items: ChartBarItem[];
  centerLabel?: string;
}) {
  const filtered = items.filter((i) => i.count > 0);
  const total = filtered.reduce((s, i) => s + i.count, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-xs" style={{ color: RF_TEXT_SECONDARY }}>
        Sem dados para exibir.
      </p>
    );
  }

  const r = 42;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segments = filtered.map((item, i) => {
    const pct = item.count / total;
    const dash = pct * circ;
    const seg = {
      ...item,
      dash,
      gap: circ - dash,
      offset: -offset,
      color: item.color ?? limeForIndex(i),
    };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 100 100" className="h-28 w-28" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(146,255,0,0.08)"
            strokeWidth="14"
          />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ filter: `drop-shadow(0 0 4px ${seg.color}66)` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums" style={{ color: PAINEL_LIME }}>
            {total}
          </span>
          {centerLabel ? (
            <span className="text-[8px] font-medium" style={{ color: RF_TEXT_SECONDARY }}>
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {segments.slice(0, 5).map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: seg.color, boxShadow: `0 0 6px ${seg.color}` }}
            />
            <span className="min-w-0 flex-1 truncate text-[10px]" style={{ color: RF_TEXT_SECONDARY }}>
              {seg.label}
            </span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: RF_TEXT_PRIMARY }}>
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Gauge semicircular — taxas %. */
export function RadialGaugeDark({
  label,
  pct,
  meta = 100,
}: {
  label: string;
  pct: number;
  meta?: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 36;
  const cx = 50;
  const cy = 52;
  const halfCirc = Math.PI * r;
  const dash = (clamped / 100) * halfCirc;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 60" className="w-full max-w-[160px]" aria-hidden>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(146,255,0,0.1)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={PAINEL_LIME}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${halfCirc}`}
          style={{ filter: `drop-shadow(0 0 6px ${PAINEL_LIME}88)` }}
        />
      </svg>
      <p className="-mt-1 text-2xl font-black tabular-nums" style={{ color: PAINEL_LIME }}>
        {clamped}%
      </p>
      <p className="text-[10px] font-medium" style={{ color: RF_TEXT_SECONDARY }}>
        {label}
      </p>
      {meta < 100 ? (
        <p className="mt-0.5 text-[9px]" style={{ color: RF_TEXT_SECONDARY }}>
          meta {meta}%
        </p>
      ) : null}
    </div>
  );
}

export function MetricBarsChartDark({ items }: { items: ChartBarItem[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-3.5">
      {items.map((item, i) => {
        const pct = Math.round((item.count / max) * 100);
        const fill = item.color ?? limeForIndex(i);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium" style={{ color: RF_TEXT_SECONDARY }}>
                {item.label}
              </span>
              <span className="text-sm font-black tabular-nums" style={{ color: RF_TEXT_PRIMARY }}>
                {item.count}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(146, 255, 0, 0.1)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(item.count > 0 ? 10 : 0, pct)}%`,
                  background: fill,
                  boxShadow: item.count > 0 ? `0 0 8px ${fill}66` : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConversaoChartDark({
  taxaQualificacao,
  taxaEncaminhamento,
  mostrarEncaminhamento = true,
}: {
  taxaQualificacao: number;
  taxaEncaminhamento: number;
  mostrarEncaminhamento?: boolean;
}) {
  if (!mostrarEncaminhamento) {
    return <RadialGaugeDark label="Qualificação" pct={taxaQualificacao} meta={40} />;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <RadialGaugeDark label="Qualificação" pct={taxaQualificacao} meta={40} />
      <RadialGaugeDark label="Encaminhamento" pct={taxaEncaminhamento} meta={15} />
    </div>
  );
}
