"use client";

import Link from "next/link";
import type { AlertaResumo } from "@/lib/crm/dashboard-aggregate";

function hrefAlerta(a: AlertaResumo): string {
  const t = a.tipo.toLowerCase();
  if (t.includes("aprov")) return "/crm/aprovacoes";
  if (t.includes("lead") || t.includes("atend")) return "/crm/atendimento";
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
      <div className="mb-6 animate-pulse rounded-2xl border border-[#2b3544] bg-[#121926] p-4">
        <div className="mb-3 h-3 w-20 rounded bg-[#21262d]" />
        <div className="h-11 rounded-xl bg-[#21262d]" />
      </div>
    );
  }

  if (alertas.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-[#2b3544] bg-[#121926] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b949e]">Alertas</p>
      <div className="space-y-2">
        {alertas.map((a) => (
          <Link
            key={a.id}
            href={hrefAlerta(a)}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#2b3544] bg-[#0f1520] px-3.5 py-2.5 transition-colors hover:border-[#d2992255] hover:bg-[#161b22]"
          >
            <span className="truncate text-sm font-medium text-[#e6edf3]">{a.titulo}</span>
            <span className="shrink-0 rounded-full border border-[#30363d] bg-[#21262d] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
              {a.tipo}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
