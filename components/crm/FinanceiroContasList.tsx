"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  type ContaFinanceira,
  type TipoConta,
  diasAteVencimento,
  labelDias,
  moedaFinanceiro,
} from "@/lib/crm/finance-contas";

type Props = {
  tipo: TipoConta;
  contas: ContaFinanceira[];
  onAtualizado: () => void;
  linkDashboard?: string;
};

const STATUS_FINAL: Record<TipoConta, { status: string; label: string }> = {
  pagar: { status: "pago", label: "Marcar pago" },
  receber: { status: "recebido", label: "Marcar recebido" },
};

export function FinanceiroContasList({ tipo, contas, onAtualizado, linkDashboard }: Props) {
  const router = useRouter();
  const final = STATUS_FINAL[tipo];

  async function marcarFinalizada(id: string) {
    const res = await fetch(`/api/crm/financeiro/contas/${tipo}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status: final.status }),
    });
    if (res.ok) onAtualizado();
  }

  if (contas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#30363d] bg-[#161b22] px-6 py-12 text-center">
        <p className="text-sm font-bold text-[#e6edf3]">Nenhum lançamento neste filtro</p>
        <p className="mt-1 text-xs text-[#8b949e]">
          Ajuste os filtros ou cadastre um novo lançamento no painel financeiro.
        </p>
        {linkDashboard && (
          <Link
            href={linkDashboard}
            className="mt-4 inline-block text-xs font-bold text-[#c9a24a] hover:underline"
          >
            Ir para visão financeira
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-2 pb-4">
      {contas.map((c) => {
        const dias = diasAteVencimento(c.vencimento);
        const atrasado = dias !== null && dias < 0 && c.status === "pendente";
        const corBorda = atrasado ? "#f85149" : tipo === "pagar" ? "#f97316" : "#3fb950";
        return (
          <li
            key={c.id}
            className="rounded-xl border border-[#30363d] bg-[#161b22] p-3"
            style={{ borderLeftWidth: 3, borderLeftColor: corBorda }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#e6edf3]">{c.descricao}</p>
                <p className="mt-1 text-lg font-black tabular-nums text-[#e6edf3]">
                  {moedaFinanceiro(c.valor)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8b949e]">
                  <span
                    className="rounded-full px-2 py-0.5 font-bold uppercase"
                    style={{
                      background: `${corBorda}22`,
                      color: corBorda,
                    }}
                  >
                    {c.status}
                  </span>
                  <span>{labelDias(dias)}</span>
                  {c.vencimento && (
                    <span>
                      {new Date(`${String(c.vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {c.status === "pendente" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void marcarFinalizada(c.id)}
                  className="min-h-11 flex-1 rounded-lg bg-[#003b26] text-xs font-bold text-[#c9a24a] hover:brightness-110"
                >
                  {final.label}
                </button>
                {tipo === "receber" && (
                  <button
                    type="button"
                    onClick={() => router.push("/crm/negocios")}
                    className="min-h-11 rounded-lg border border-[#30363d] px-3 text-xs font-semibold text-[#8b949e]"
                  >
                    Negócios
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
