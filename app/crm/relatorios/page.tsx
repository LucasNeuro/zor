"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { useMetricas } from "@/hooks/useMetricas";
import {
  formatarCelulaRelatorio,
  RELATORIO_ENTIDADES_UI,
  RELATORIO_HEADER_LABELS,
  type RelatorioEntidade,
} from "@/lib/crm/relatorios-data";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";

type LinhaResumo = {
  titulo: string;
  valor: string;
  detalhe: string;
};

type RelatorioJson = {
  entidade: string;
  headers: string[];
  rows: Record<string, unknown>[];
  total: number;
  aviso?: string;
};

export default function Relatorios() {
  const metricas = useMetricas();
  const [decisoesPendentes, setDecisoesPendentes] = useState(0);
  const [kpisForaMeta, setKpisForaMeta] = useState(0);
  const [entidadeAtiva, setEntidadeAtiva] = useState<RelatorioEntidade>("leads");
  const [dataset, setDataset] = useState<RelatorioJson | null>(null);
  const [tabelaLoading, setTabelaLoading] = useState(true);
  const [tabelaErro, setTabelaErro] = useState<string | null>(null);

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

    void carregarComplementos();
  }, []);

  const linhasResumo = useMemo<LinhaResumo[]>(
    () => [
      {
        titulo: "Funil de conversão",
        valor: `${metricas.taxaQualificacao}% qualificação`,
        detalhe: `${metricas.leadsHoje} leads hoje; ${metricas.taxaEncaminhamento}% encaminhamento`,
      },
      {
        titulo: "Atendimento",
        valor: `${metricas.mensagensFilaPendentes} mensagens na fila`,
        detalhe: `${metricas.leadsAguardando} leads aguardando ação`,
      },
      {
        titulo: "Receita em risco",
        valor: `R$ ${metricas.receitaPotencial.toLocaleString("pt-BR")}`,
        detalhe: "Soma de oportunidades abertas no CRM",
      },
      {
        titulo: "Rede de parceiros",
        valor: `${metricas.parceirosAtivos} parceiros ativos`,
        detalhe: `${metricas.encaminhamentosHoje} encaminhamentos hoje`,
      },
      {
        titulo: "Auditoria de decisões",
        valor: `${decisoesPendentes} pendentes`,
        detalhe: `${kpisForaMeta} KPIs fora da meta nas últimas 24h`,
      },
    ],
    [decisoesPendentes, kpisForaMeta, metricas]
  );

  const carregarTabela = useCallback(async () => {
    setTabelaLoading(true);
    setTabelaErro(null);
    try {
      const res = await fetch(
        `/api/crm/relatorios/export?entidade=${encodeURIComponent(entidadeAtiva)}&format=json`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const json = (await res.json().catch(() => ({}))) as RelatorioJson & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setDataset(json);
    } catch (e) {
      setDataset(null);
      setTabelaErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setTabelaLoading(false);
    }
  }, [entidadeAtiva]);

  useEffect(() => {
    void carregarTabela();
  }, [carregarTabela]);

  const entidadeLabel =
    RELATORIO_ENTIDADES_UI.find((e) => e.id === entidadeAtiva)?.label ?? entidadeAtiva;

  return (
    <div className="flex min-h-full flex-col bg-[#0d1117]">
      <CrmStickyPageHeader
        title="Relatórios"
        description="Consulta operacional na tela — dados reais do Supabase"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Resumo operacional</p>
          {metricas.loading ? (
            <p className="text-sm text-[#8b949e]">Carregando métricas…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {linhasResumo.map((item) => (
                <div key={item.titulo} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                  <p className="text-sm font-bold text-[#e6edf3]">{item.titulo}</p>
                  <p className="mt-3 text-2xl font-black text-[#f97316]">{item.valor}</p>
                  <p className="mt-2 text-xs leading-5 text-[#8b949e]">{item.detalhe}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-[#6e7681]">Fonte: `/api/crm/metricas`</p>
        </div>

        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#e6edf3]">Detalhamento — {entidadeLabel}</p>
              <p className="mt-1 text-xs text-[#8b949e]">
                {dataset ? `${dataset.total} registo(s) (máx. 500)` : "Selecione uma aba para ver os dados"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void carregarTabela()}
              disabled={tabelaLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-bold text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${tabelaLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {RELATORIO_ENTIDADES_UI.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEntidadeAtiva(e.id)}
                className="rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                style={{
                  background: entidadeAtiva === e.id ? "#30363d" : "#21262d",
                  color: entidadeAtiva === e.id ? "#e6edf3" : "#8b949e",
                  border: `1px solid ${entidadeAtiva === e.id ? "#c9a24a66" : "#30363d"}`,
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          {tabelaErro && (
            <div className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-3 text-sm text-[#ff7b72]">
              {tabelaErro}
              <button
                type="button"
                onClick={() => void carregarTabela()}
                className="ml-2 text-xs underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!tabelaErro && dataset?.aviso && (
            <div className="mb-4 rounded-lg border border-[#d2992266] bg-[#d2992218] px-3 py-3 text-xs leading-relaxed text-[#e3b341]">
              {dataset.aviso}
            </div>
          )}

          {tabelaLoading ? (
            <p className="py-12 text-center text-sm text-[#8b949e]">Carregando {entidadeLabel.toLowerCase()}…</p>
          ) : dataset && dataset.rows.length === 0 && !dataset.aviso ? (
            <p className="py-12 text-center text-sm text-[#8b949e]">Nenhum registo encontrado.</p>
          ) : dataset && (dataset.rows.length > 0 || dataset.aviso) ? (
            <div className="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-[#30363d]">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#21262d]">
                  <tr className="border-b border-[#30363d] text-[#8b949e]">
                    {dataset.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2.5 font-bold">
                        {RELATORIO_HEADER_LABELS[h] ?? h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-[#21262d] text-[#e6edf3] hover:bg-[#21262d]/60">
                      {dataset.headers.map((h) => (
                        <td key={h} className="max-w-[220px] truncate whitespace-nowrap px-3 py-2" title={String(row[h] ?? "")}>
                          {formatarCelulaRelatorio(h, row[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
