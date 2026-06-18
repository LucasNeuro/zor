"use client";

import type { ReactNode } from "react";
import { WO } from "@/components/crm/waje/waje-owner-theme";

export function WajeOwnerSectionTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex gap-6 overflow-x-auto border-b px-4 sm:px-5"
      style={{ borderColor: WO.border }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className="relative -mb-px shrink-0 pb-3 pt-3 text-sm font-semibold transition-colors"
            style={{
              color: active ? WO.accent : WO.textMuted,
              borderBottom: active ? `2px solid ${WO.accent}` : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function WajeOwnerMetricCard({
  label,
  valor,
  sub,
  tone = "default",
}: {
  label: string;
  valor: string | number;
  sub?: ReactNode;
  tone?: "default" | "success" | "danger" | "warning" | "muted";
}) {
  const accent =
    tone === "success"
      ? "#3fb950"
      : tone === "danger"
        ? "#f85149"
        : tone === "warning"
          ? "#d29922"
          : tone === "muted"
            ? WO.textMuted
            : WO.accent;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: WO.metricBg,
        borderColor: WO.borderStrong,
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: WO.textMuted }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
        {valor}
      </p>
      {sub ? (
        <p className="mt-1 text-xs" style={{ color: WO.textMuted }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function WajeOwnerStatusBadge({
  variant,
  label,
}: {
  variant: "ativo" | "inativo" | "pendente" | "pago" | "atrasado" | "neutral";
  label?: string;
}) {
  const map = {
    ativo: { bg: "rgba(63,185,80,0.18)", color: "#3fb950", label: "Ativo" },
    inativo: { bg: "rgba(248,81,73,0.14)", color: "#f85149", label: "Inativo" },
    pendente: { bg: "rgba(210,153,34,0.16)", color: "#d29922", label: "Pendente" },
    pago: { bg: "rgba(63,185,80,0.18)", color: "#3fb950", label: "Pago" },
    atrasado: { bg: "rgba(248,81,73,0.14)", color: "#f85149", label: "Atrasado" },
    neutral: { bg: "rgba(122,154,126,0.14)", color: WO.textMuted, label: "—" },
  } as const;
  const s = map[variant] ?? map.neutral;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      {label ?? s.label}
    </span>
  );
}
