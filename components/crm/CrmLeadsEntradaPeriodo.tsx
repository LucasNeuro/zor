"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { periodoLabel } from "@/lib/crm/analytics-period";

export type PontoEntrada = { dia: string; label: string; count: number };

function agruparPorSemana(pontos: PontoEntrada[]): PontoEntrada[] {
  const semanas = new Map<string, PontoEntrada>();
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

type Props = {
  pontos: PontoEntrada[];
  periodo: AnalyticsPeriodo;
};

/**
 * Ritmo de captação: quantos leads novos entraram por dia no período do Analytics.
 * Não é estoque do funil — é volume de criação (hub_leads_crm.criado_em).
 */
export function CrmLeadsEntradaPeriodo({ pontos, periodo }: Props) {
  const exibir = periodo === "30d" ? agruparPorSemana(pontos) : pontos;
  const porSemana = periodo === "30d";
  const total = exibir.reduce((s, p) => s + p.count, 0);
  const diasComDado = exibir.length || 1;
  const media = diasComDado > 0 ? Math.round((total / diasComDado) * 10) / 10 : 0;
  const pico = exibir.reduce(
    (best, p) => (p.count > best.count ? p : best),
    exibir[0] ?? { dia: "", label: "—", count: 0 }
  );
  const max = Math.max(1, ...exibir.map((p) => p.count));

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#dcebd8] bg-[#ffffff] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5d7a67]">Entrada de leads</p>
          <p className="mt-0.5 text-[10px] leading-snug text-[#6e7681]">
            Novos leads {porSemana ? "por semana" : "por dia"} · {periodoLabel(periodo)}
          </p>
        </div>
        <TrendingUp className="h-4 w-4 shrink-0 text-[#c9a24a]" aria-hidden />
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1 text-center">
        <div className="rounded-md bg-[#f8fcf6] px-1 py-1.5">
          <p className="text-[9px] text-[#6e7681]">Total</p>
          <p className="text-sm font-black tabular-nums text-[#0b2210]">{total}</p>
        </div>
        <div className="rounded-md bg-[#f8fcf6] px-1 py-1.5">
          <p className="text-[9px] text-[#6e7681]">{porSemana ? "Média/sem." : "Média/dia"}</p>
          <p className="text-sm font-black tabular-nums text-[#c9a24a]">{media}</p>
        </div>
        <div className="rounded-md bg-[#f8fcf6] px-1 py-1.5">
          <p className="text-[9px] text-[#6e7681]">Pico</p>
          <p className="text-sm font-black tabular-nums text-[#0b2210]">
            {pico.count}
            {pico.count > 0 && (
              <span className="block text-[8px] font-normal text-[#6e7681]">{pico.label}</span>
            )}
          </p>
        </div>
      </div>

      {exibir.length === 0 || total === 0 ? (
        <p className="flex-1 text-center text-[10px] text-[#6e7681]">Sem entradas neste período.</p>
      ) : (
        <div
          className="flex flex-1 items-end justify-between gap-0.5 px-0.5"
          role="img"
          aria-label={`Entrada de leads: ${total} no período`}
        >
          {exibir.map((p) => (
            <div
              key={p.dia}
              className="group flex min-w-0 flex-1 flex-col items-center"
              title={`${p.label}: ${p.count} lead${p.count !== 1 ? "s" : ""}`}
            >
              <span className="mb-0.5 text-[9px] font-bold tabular-nums text-[#5d7a67] opacity-0 transition-opacity group-hover:opacity-100">
                {p.count > 0 ? p.count : ""}
              </span>
              <div
                className="w-full max-w-[1.25rem] rounded-t bg-[#c9a24a] transition-all"
                style={{
                  height: `${Math.max(4, Math.round((p.count / max) * 36))}px`,
                  opacity: p.count > 0 ? 1 : 0.25,
                }}
              />
              {exibir.length <= 7 && (
                <span className="mt-1 max-w-full truncate text-[8px] text-[#484f58]">{p.label}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        href="/crm/leads?view=kanban"
        className="mt-2 block text-center text-[10px] font-bold text-[#c9a24a] hover:underline"
      >
        Ver leads no kanban →
      </Link>
    </div>
  );
}
