"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LeadRecente } from "@/lib/crm/dashboard-aggregate";

const ESTAGIO_LABEL: Record<string, string> = {
  novo: "Novo",
  qualificando: "Qualificando",
  qualificado: "Qualificado",
  proposta: "Proposta",
  negociando: "Negociando",
  fechamento: "Fechamento",
  ganho: "Ganho",
  perdido: "Perdido",
};

function quando(iso: string | null, fallback: string): string {
  const d = new Date(iso || fallback);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CrmUltimosLeads({
  leads,
  loading,
}: {
  leads: LeadRecente[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mb-6 animate-pulse rounded-xl border border-[#30363d] bg-[#161b22] p-4">
        <div className="mb-3 h-4 w-40 rounded bg-[#21262d]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2 h-10 rounded bg-[#21262d]" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-sm font-bold text-[#e6edf3]">Últimos movimentos</h2>
        <Link href="/crm/leads" className="text-xs font-bold text-[#c9a24a] hover:underline">
          Ver todos
        </Link>
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-[#8b949e]">Nenhum lead cadastrado ainda.</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/crm/leads/${l.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#0d1117]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e6edf3]">
                    {l.nome || `Lead ${l.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-[#6e7681]">
                    {ESTAGIO_LABEL[l.estagio ?? "novo"] ?? l.estagio} · {quando(l.atualizado_em, l.criado_em)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#484f58]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
