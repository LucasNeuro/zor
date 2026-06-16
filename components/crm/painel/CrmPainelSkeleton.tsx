"use client";

import type { CSSProperties } from "react";
import type { PainelTabId } from "@/lib/crm/painel-tabs";
import { RF_BG_CARD, RF_BORDER_STRONG } from "@/lib/crm/crm-retrofit-dark-theme";

const SKEL_DARK = "rgba(146, 255, 0, 0.1)";
const SKEL_DARK_STRONG = "rgba(146, 255, 0, 0.16)";
const SKEL_LIGHT = "#e8f0e6";
const SKEL_LIGHT_STRONG = "#dcebd8";

function SkelBar({
  className = "",
  dark = true,
  style,
}: {
  className?: string;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: dark ? SKEL_DARK : SKEL_LIGHT, ...style }}
      aria-hidden
    />
  );
}

function chartCountForTab(tabId: PainelTabId): number {
  const map: Record<PainelTabId, number> = {
    "visao-geral": 6,
    comercial: 5,
    atendimento: 4,
    operacao: 4,
    financeiro: 4,
    personalizado: 0,
  };
  return map[tabId] ?? 6;
}

export function CrmPainelMetricsSkeleton({ count = 4 }: { count?: number }) {
  if (count <= 0) return null;

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
      aria-busy
      aria-label="A carregar métricas"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl px-3.5 py-3.5"
          style={{
            border: "1px solid rgba(146, 255, 0, 0.2)",
            background: "rgba(11, 31, 16, 0.92)",
          }}
        >
          <SkelBar className="h-2.5 w-24" />
          <SkelBar className="mt-3 h-8 w-16" style={{ background: SKEL_DARK_STRONG }} />
          <SkelBar className="mt-2 h-2 w-32" />
          <SkelBar className="mt-3 h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChartCardSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div
      className={`flex min-h-[200px] flex-col overflow-hidden rounded-2xl px-4 py-4 ${wide ? "md:col-span-2" : ""}`}
      style={{
        border: "1px solid rgba(146, 255, 0, 0.1)",
        background:
          "linear-gradient(155deg, rgba(16, 36, 20, 0.92) 0%, rgba(6, 13, 8, 0.98) 55%, rgba(4, 10, 6, 1) 100%)",
      }}
    >
      <SkelBar className="h-3 w-28" />
      <SkelBar className="mt-1.5 h-2 w-40" />
      <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
        <SkelBar className="h-16 w-full rounded-xl" style={{ background: SKEL_DARK_STRONG }} />
        <div className="flex items-end justify-between gap-1 pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkelBar
              key={i}
              className="w-full max-w-[1.25rem] rounded-t-md"
              style={{
                height: `${20 + (i % 3) * 14}px`,
                background: SKEL_DARK_STRONG,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CrmPainelChartsSkeleton({ tabId = "visao-geral" }: { tabId?: PainelTabId }) {
  const n = chartCountForTab(tabId);
  if (n <= 0) return null;

  return (
    <div
      className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
      aria-busy
      aria-label="A carregar gráficos"
    >
      {Array.from({ length: n }).map((_, i) => (
        <ChartCardSkeleton key={i} wide={i === 0 && (tabId === "visao-geral" || tabId === "comercial")} />
      ))}
    </div>
  );
}

export function CrmPainelToolbarSkeleton({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" aria-hidden>
      <SkelBar className="h-3 w-64 max-w-full" dark={dark} />
      <div className="flex gap-2">
        <SkelBar className="h-8 w-36 rounded-xl" dark={dark} />
        <SkelBar className="h-8 w-28 rounded-xl" dark={dark} />
      </div>
    </div>
  );
}

export function CrmPainelTableSkeleton() {
  return (
    <div className="px-4 pb-4" aria-busy aria-label="A carregar tabela">
      <div className="border-b border-[#eef5ec] py-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <SkelBar className="h-10 w-full rounded-xl" dark={false} />
          <SkelBar className="h-10 w-24 rounded-xl" dark={false} />
          <SkelBar className="h-10 w-24 rounded-xl" dark={false} />
          <SkelBar className="h-10 w-24 rounded-xl" dark={false} />
        </div>
      </div>
      <SkelBar className="mx-2 mt-3 h-2.5 w-48" dark={false} />
      <div className="mt-3 overflow-hidden rounded-lg border border-[#dcebd8]">
        <div className="flex gap-3 border-b border-[#dcebd8] bg-[#f0f7ee] px-3 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkelBar key={i} className="h-3 flex-1" dark={false} style={{ background: SKEL_LIGHT_STRONG }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={row}
            className="flex gap-3 border-b border-[#eef7eb] px-3 py-3 last:border-0"
          >
            {Array.from({ length: 6 }).map((_, col) => (
              <SkelBar
                key={col}
                className="h-3 flex-1"
                dark={false}
                style={{ width: col === 0 ? "80%" : "60%", background: SKEL_LIGHT }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
