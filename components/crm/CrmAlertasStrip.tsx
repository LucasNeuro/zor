"use client";

import Link from "next/link";
import type { AlertaResumo } from "@/lib/crm/dashboard-aggregate";

function hrefAlerta(a: AlertaResumo): string {
  const t = a.tipo.toLowerCase();
  if (t.includes("aprov")) return "/crm/aprovacoes";
  if (t.includes("lead") || t.includes("atend")) return "/crm/leads";
  return "/crm/aprovacoes";
}

export function CrmAlertasStrip({
  alertas,
  loading,
}: {
  alertas: AlertaResumo[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mb-6 animate-pulse rounded-2xl border border-[#e8f0e6] bg-[#ffffff] p-4">
        <div className="mb-3 h-3 w-20 rounded bg-[#e8f0e6]" />
        <div className="h-11 rounded-xl bg-[#dcebd8]" />
      </div>
    );
  }

  if (alertas.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-[#dcebd8] bg-[#ffffff] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5d7a67]">Alertas</p>
      <div className="space-y-2">
        {alertas.map((a) => (
          <Link
            key={a.id}
            href={hrefAlerta(a)}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#dcebd8] bg-[#0f1520] px-3.5 py-2.5 transition-colors hover:border-[#d2992255] hover:bg-[#ffffff]"
          >
            <span className="truncate text-sm font-medium text-[#0b2210]">{a.titulo}</span>
            <span className="shrink-0 rounded-full border border-[#dcebd8] bg-[#eef7eb] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5d7a67]">
              {a.tipo}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
