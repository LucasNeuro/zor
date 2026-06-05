"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinanceiroContasList } from "@/components/crm/FinanceiroContasList";
import { FinanceiroNovoLancamentoModal } from "@/components/crm/FinanceiroNovoLancamentoModal";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import {
  type ContaFinanceira,
  STATUS_PAGAR,
  filtrarContas,
} from "@/lib/crm/finance-contas";
import { supabase } from "@/lib/supabase/client";

function ContasPagarInner() {
  const searchParams = useSearchParams();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);

  const statusFiltro = searchParams.get("status") || "";
  const vencido = searchParams.get("vencido") === "1";
  const proximos = searchParams.get("proximos");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("hub_contas_pagar")
      .select("*")
      .order("vencimento", { ascending: true, nullsFirst: false });
    setContas(
      (data ?? []).map((c) => ({
        id: String(c.id),
        descricao: String(c.descricao ?? ""),
        valor: Number(c.valor ?? 0),
        vencimento: c.vencimento != null ? String(c.vencimento) : null,
        status: String(c.status ?? "pendente"),
        criado_em: c.criado_em != null ? String(c.criado_em) : undefined,
      }))
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(
    () =>
      filtrarContas(contas, {
        status: statusFiltro || undefined,
        vencido: vencido || undefined,
        proximos: proximos ? Number(proximos) : undefined,
      }),
    [contas, statusFiltro, vencido, proximos]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f8fcf6]">
      <div className="sticky top-0 z-10 shrink-0 border-b border-[#dcebd8] bg-[#ffffff] px-3 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link href="/crm/financeiro" className="text-[11px] font-bold text-[#c9a24a] hover:underline">
              ← Visão financeira
            </Link>
            <h1 className="mt-1 text-lg font-bold text-[#0b2210]">Contas a pagar</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalNovo(true)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Novo
            </button>
            <button
              type="button"
              onClick={() => {
                fetch("/api/crm/relatorios/export?entidade=contas_pagar", { headers: internalApiHeaders() })
                  .then(async (res) => {
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `waje-contas-pagar-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch(() => {});
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 text-xs font-bold text-[#5d7a67]"
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/crm/financeiro/pagar"
            className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${!statusFiltro && !vencido && !proximos ? "bg-[#dcebd8] text-white" : "bg-[#eef7eb] text-[#5d7a67]"}`}
          >
            Todas
          </Link>
          {STATUS_PAGAR.map((s) => (
            <Link
              key={s.id}
              href={`/crm/financeiro/pagar?status=${s.id}`}
              className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${statusFiltro === s.id && !vencido ? "bg-[#dcebd8] text-white" : "bg-[#eef7eb] text-[#5d7a67]"}`}
            >
              {s.label}
            </Link>
          ))}
          <Link
            href="/crm/financeiro/pagar?status=pendente&vencido=1"
            className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${vencido ? "bg-[#b3261e] text-white" : "bg-[#eef7eb] text-[#5d7a67]"}`}
          >
            Vencidas
          </Link>
          <Link
            href="/crm/financeiro/pagar?status=pendente&proximos=7"
            className={`min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${proximos === "7" ? "bg-[#c9a24a] text-[#003b26]" : "bg-[#eef7eb] text-[#5d7a67]"}`}
          >
            7 dias
          </Link>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${isMobile ? "p-3" : "p-6"}`}>
        {carregando ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#eef7eb]" />
            ))}
          </div>
        ) : (
          <FinanceiroContasList
            tipo="pagar"
            contas={filtradas}
            onAtualizado={carregar}
            linkDashboard="/crm/financeiro"
          />
        )}
      </div>

      <FinanceiroNovoLancamentoModal
        open={modalNovo}
        onClose={() => setModalNovo(false)}
        onCriado={() => void carregar()}
        tipoInicial="pagar"
      />
    </div>
  );
}

export default function ContasPagarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f8fcf6] p-6 text-sm text-[#5d7a67]">
          Carregando contas a pagar…
        </div>
      }
    >
      <ContasPagarInner />
    </Suspense>
  );
}
