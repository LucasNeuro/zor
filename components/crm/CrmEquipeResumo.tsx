"use client";

import Link from "next/link";
import type { Agente } from "@/hooks/useAgentes";
import type { CicloStatus } from "@/lib/crm/dashboard-aggregate";

const MAX = 4;

export function CrmEquipeResumo({
  agentes,
  ciclos,
  loading,
}: {
  agentes: Agente[];
  ciclos: CicloStatus[];
  loading: boolean;
}) {
  const cicloPorAgente = new Map(ciclos.map((c) => [c.agente_slug, c.ultimo_status]));

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-[#2b3544] bg-[#121926] p-4">
        <div className="mb-3 h-4 w-24 rounded bg-[#21262d]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2 h-12 rounded-xl bg-[#21262d]" />
        ))}
      </div>
    );
  }

  const lista = agentes.slice(0, MAX);

  return (
    <section className="rounded-2xl border border-[#2b3544] bg-[#121926] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-bold tracking-tight text-[#e6edf3]">Equipe IA</h2>
        <Link
          href="/crm/agentes"
          className="rounded-lg border border-[#30363d] px-2 py-1 text-xs font-bold text-[#c9a24a] transition-colors hover:border-[#c9a24a55]"
        >
          Ver todos →
        </Link>
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-[#8b949e]">Nenhum agente ativo.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lista.map((a) => {
            const status = cicloPorAgente.get(a.agente_slug);
            const erro = status === "erro";
            return (
              <Link
                key={a.agente_slug}
                href={`/crm/agentes/${a.agente_slug}`}
                className="flex items-center gap-3 rounded-xl border border-[#2b3544] bg-[#0f1520] px-3 py-2.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#c9a24a55]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#003b26] text-sm font-black text-[#c9a24a]">
                  {(a.nome || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#e6edf3]">{a.nome}</p>
                  <p className="truncate text-xs text-[#8b949e]">{a.cargo}</p>
                </div>
                {erro ? (
                  <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-[#f8514926] text-[#ff7b72]">
                    Ciclo erro
                  </span>
                ) : (
                  <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold bg-[#003b2630] text-[#c9a24a]">
                    N{a.nivel}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
