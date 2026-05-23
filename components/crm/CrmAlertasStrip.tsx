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
      <div className="mb-6 animate-pulse space-y-2">
        <div className="h-3 w-20 rounded bg-[#21262d]" />
        <div className="h-10 rounded-lg bg-[#21262d]" />
      </div>
    );
  }

  if (alertas.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6e7681]">Alertas</p>
      <div className="space-y-2">
        {alertas.map((a) => (
          <Link
            key={a.id}
            href={hrefAlerta(a)}
            className="flex items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 transition-colors hover:border-[#c9a24a44] hover:bg-[#21262d]"
          >
            <span className="truncate text-sm text-[#e6edf3]">{a.titulo}</span>
            <span className="shrink-0 text-[10px] font-bold uppercase text-[#8b949e]">{a.tipo}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
