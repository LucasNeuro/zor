"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { useMetricas } from "@/hooks/useMetricas";
import { supabase } from "@/lib/supabase/client";

type LinhaRelatorio = {
  titulo: string;
  valor: string;
  detalhe: string;
};

function baixarCsv(nome: string, linhas: LinhaRelatorio[]) {
  const csv = [
    "relatorio,valor,detalhe",
    ...linhas.map((linha) =>
      [linha.titulo, linha.valor, linha.detalhe]
        .map((campo) => `"${campo.replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  const metricas = useMetricas();
  const [decisoesPendentes, setDecisoesPendentes] = useState(0);
  const [kpisForaMeta, setKpisForaMeta] = useState(0);

  useEffect(() => {
    async function carregarComplementos() {
      const [aprovacoes, kpis] = await Promise.all([
        supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase
          .from("hub_kpis_resultados")
          .select("id", { count: "exact", head: true })
          .neq("nivel_alerta", "ok")
          .gte("criado_em", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);
      setDecisoesPendentes(aprovacoes.count ?? 0);
      setKpisForaMeta(kpis.count ?? 0);
    }

    carregarComplementos();
  }, []);

  const linhas = useMemo<LinhaRelatorio[]>(() => [
    {
      titulo: "Funil de Conversão",
      valor: `${metricas.taxaQualificacao}% qualificação`,
      detalhe: `${metricas.leadsHoje} leads hoje; ${metricas.taxaEncaminhamento}% encaminhamento`,
    },
    {
      titulo: "Atendimento",
      valor: `${metricas.conversasAtivas} conversas ativas`,
      detalhe: `${metricas.leadsAguardando} leads aguardando ação`,
    },
    {
      titulo: "Receita em Risco",
      valor: `R$ ${metricas.receitaPotencial.toLocaleString("pt-BR")}`,
      detalhe: "Soma de oportunidades abertas no CRM",
    },
    {
      titulo: "Rede de Parceiros",
      valor: `${metricas.parceirosAtivos} parceiros ativos`,
      detalhe: `${metricas.encaminhamentosHoje} encaminhamentos hoje`,
    },
    {
      titulo: "Auditoria de Decisões",
      valor: `${decisoesPendentes} pendentes`,
      detalhe: `${kpisForaMeta} KPIs fora da meta nas últimas 24h`,
    },
  ], [decisoesPendentes, kpisForaMeta, metricas]);

  return (
    <div className="flex min-h-full flex-col bg-[#0d1117]">
      <CrmStickyPageHeader
        title="Relatórios"
        description="Dados reais do CRM, exportáveis em CSV"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#e6edf3]">Resumo operacional</p>
              <p className="mt-1 text-xs text-[#8b949e]">
                Atualizado a partir de Supabase via `/api/crm/metricas`.
              </p>
            </div>
            <button
              onClick={() => baixarCsv("relatorio-operacional", linhas)}
              className="rounded-lg border border-[#f9731640] bg-[#f973161a] px-3 py-2 text-xs font-bold text-[#f97316] hover:bg-[#f9731626]"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {metricas.loading ? (
          <div className="mt-12 text-center text-sm text-[#8b949e]">Carregando métricas...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {linhas.map((item) => (
              <div key={item.titulo} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                <p className="text-sm font-bold text-[#e6edf3]">{item.titulo}</p>
                <p className="mt-3 text-2xl font-black text-[#f97316]">{item.valor}</p>
                <p className="mt-2 text-xs leading-5 text-[#8b949e]">{item.detalhe}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
