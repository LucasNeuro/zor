"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Download, Plus, TrendingUp, Wallet } from "lucide-react";
import { FinanceiroNovoLancamentoModal } from "@/components/crm/FinanceiroNovoLancamentoModal";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { CrmMetricCard, CrmSectionTitle } from "@/components/crm/CrmMetricCard";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";
import { moedaFinanceiro } from "@/lib/crm/finance-contas";
import type { FinanceDashboardState } from "@/hooks/useFinanceDashboard";

function CrmFinanceAcaoAgora({
  dash,
  indisponivel,
}: {
  dash: FinanceDashboardState;
  indisponivel?: boolean;
}) {
  if (indisponivel) return null;

  if (dash.loading) {
    return (
      <div className="mb-4 animate-pulse rounded-xl border border-[#30363d] bg-[#161b22] p-4">
        <div className="h-4 w-28 rounded bg-[#21262d]" />
        <div className="mt-3 h-10 rounded-lg bg-[#21262d]" />
      </div>
    );
  }

  if (dash.acao.length === 0 && dash.carregado) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#23863644] bg-[#003b2618] px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3fb950]" />
        <p className="text-sm text-[#e6edf3]">Caixa em dia no período — sem vencidos nem vencimentos críticos.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-[#c9a24a44] bg-[#161b22] p-3 sm:p-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#c9a24a]">Ação agora</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {dash.acao.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 flex-1 items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 transition-colors hover:border-[#c9a24a55]"
          >
            <span className="text-xs font-semibold text-[#e6edf3]">
              {item.label}
              <span className="ml-1 text-[#8b949e]">({item.count})</span>
            </span>
            <span className="text-sm font-black tabular-nums" style={{ color: item.cor }}>
              {moedaFinanceiro(item.valor)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function exportarCsv(entidade: string) {
  const url = `/api/crm/relatorios/export?entidade=${encodeURIComponent(entidade)}`;
  fetch(url, { headers: internalApiHeaders() })
    .then(async (res) => {
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `obra10-${entidade}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => {});
}

export function CrmFinanceDashboard({ dash }: { dash: FinanceDashboardState }) {
  const indisponivel = !!dash.erro && !dash.carregado;
  const { kpis, pipeline } = dash;
  const saldoPositivo = kpis.saldoProjetado >= 0;
  const [modalNovo, setModalNovo] = useState(false);

  return (
    <div className="relative min-h-0 bg-[#0d1117] p-3 pb-20 sm:pb-6 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#c9a24a]" aria-hidden />
          <div>
            <h1 className="text-lg font-bold text-[#e6edf3]">Visão financeira</h1>
            <p className="text-xs text-[#8b949e]">Caixa, aprovações e pipeline comercial</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalNovo(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-3 py-2 text-xs font-bold text-[#003b26]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo lançamento
          </button>
          <button
            type="button"
            onClick={() => exportarCsv("financeiro")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-bold text-[#8b949e] hover:text-[#e6edf3]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Exportar CSV
          </button>
          <Link
            href="/crm/financeiro/pagar"
            className="min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-bold text-[#e6edf3] hover:border-[#c9a24a55]"
          >
            Contas a pagar
          </Link>
          <Link
            href="/crm/financeiro/receber"
            className="min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-xs font-bold text-[#e6edf3] hover:border-[#c9a24a55]"
          >
            Contas a receber
          </Link>
        </div>
      </div>

      <FinanceiroNovoLancamentoModal
        open={modalNovo}
        onClose={() => setModalNovo(false)}
        onCriado={() => dash.recarregar()}
      />

      {dash.erro && (
        <div
          className="mb-4 rounded-xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff7b72]"
          role="alert"
        >
          {dash.erro}
          <button
            type="button"
            onClick={() => dash.recarregar()}
            className="ml-2 text-xs font-bold underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <CrmFinanceAcaoAgora dash={dash} indisponivel={indisponivel} />

      <CrmSectionTitle>Caixa</CrmSectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <CrmMetricCard
          label="A pagar (aberto)"
          valor={moedaFinanceiro(kpis.aPagarAberto)}
          sub="pendentes"
          cor="#f97316"
          href="/crm/financeiro/pagar?status=pendente"
          loading={dash.loading}
        />
        <CrmMetricCard
          label="A receber (aberto)"
          valor={moedaFinanceiro(kpis.aReceberAberto)}
          sub="pendentes"
          cor="#3fb950"
          href="/crm/financeiro/receber?status=pendente"
          loading={dash.loading}
        />
        <CrmMetricCard
          label="Vencido"
          valor={moedaFinanceiro(kpis.vencidoTotal)}
          sub={`${moedaFinanceiro(kpis.vencidoPagar)} pagar · ${moedaFinanceiro(kpis.vencidoReceber)} receber`}
          cor={kpis.vencidoTotal > 0 ? "#f85149" : "#8b949e"}
          href="/crm/financeiro/pagar?status=pendente&vencido=1"
          loading={dash.loading}
        />
        <CrmMetricCard
          label="Saldo projetado"
          valor={moedaFinanceiro(kpis.saldoProjetado)}
          sub="receber − pagar (não é saldo bancário)"
          cor={saldoPositivo ? "#3fb950" : "#f85149"}
          loading={dash.loading}
        />
      </div>

      <CrmSectionTitle>Pipeline comercial (leitura)</CrmSectionTitle>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CrmMetricCard
          label="Receita potencial (leads)"
          valor={moedaPipeline(pipeline.receitaPotencialLeads)}
          sub="funil em aberto"
          cor="#60a5fa"
          href="/crm/leads"
          loading={dash.loading}
        />
        <CrmMetricCard
          label="Receita potencial (negócios)"
          valor={moedaPipeline(pipeline.receitaPotencialNegocios)}
          sub="abertos / em negociação"
          cor="#a78bfa"
          href="/crm/negocios"
          loading={dash.loading}
        />
        <CrmMetricCard
          label="Negócios sit-down"
          valor={pipeline.negociosSitDown}
          sub="etapa pré-conclusão"
          cor="#c9a24a"
          href="/crm/negocios"
          loading={dash.loading}
        />
      </div>

      <CrmSectionTitle>Aprovações financeiras</CrmSectionTitle>
      <div className="mb-6 rounded-xl border border-[#30363d] bg-[#161b22] p-3 sm:p-4">
        {dash.loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-[#21262d]" />
        ) : dash.aprovacoes.length === 0 ? (
          <p className="text-sm text-[#8b949e]">Nenhuma aprovação financeira pendente.</p>
        ) : (
          <ul className="space-y-2">
            {dash.aprovacoes.map((a) => (
              <li key={a.id}>
                <Link
                  href="/crm/aprovacoes?tipo=financeiro"
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 hover:border-[#c9a24a44]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-[#f85149]" />
                    <span className="truncate text-xs font-semibold text-[#e6edf3]">{a.descricao}</span>
                  </span>
                  {a.valor_envolvido > 0 && (
                    <span className="shrink-0 text-xs font-bold text-[#c9a24a]">
                      {moedaFinanceiro(a.valor_envolvido)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/crm/aprovacoes?tipo=financeiro"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c9a24a] hover:underline"
        >
          Ver todas as aprovações
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <CrmSectionTitle>Próximos vencimentos</CrmSectionTitle>
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
        {dash.loading ? (
          <div className="p-4">
            <div className="h-20 animate-pulse rounded-lg bg-[#21262d]" />
          </div>
        ) : dash.proximosVencimentos.length === 0 ? (
          <p className="p-4 text-sm text-[#8b949e]">Sem lançamentos pendentes com vencimento.</p>
        ) : (
          <ul className="divide-y divide-[#21262d]">
            {dash.proximosVencimentos.map((l) => {
              const href =
                l.tipo === "pagar"
                  ? "/crm/financeiro/pagar?status=pendente"
                  : "/crm/financeiro/receber?status=pendente";
              const atrasado = l.diasAte !== null && l.diasAte < 0;
              return (
                <li key={`${l.tipo}-${l.id}`}>
                  <Link
                    href={href}
                    className="flex min-h-12 items-center justify-between gap-2 px-3 py-2.5 hover:bg-[#21262d]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#e6edf3]">{l.descricao}</p>
                      <p className="text-[10px] text-[#8b949e]">
                        <span
                          className="mr-2 font-bold uppercase"
                          style={{ color: l.tipo === "pagar" ? "#f97316" : "#3fb950" }}
                        >
                          {l.tipo === "pagar" ? "Pagar" : "Receber"}
                        </span>
                        {l.vencimento
                          ? new Date(`${l.vencimento.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
                          : "—"}
                        {atrasado && (
                          <span className="ml-2 font-bold text-[#f85149]">Atrasado</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-[#e6edf3]">
                      {moedaFinanceiro(l.valor)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-2 border-t border-[#21262d] px-3 py-2 text-[10px] text-[#6e7681]">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          Valores projetados; confirme no banco antes de pagar ou receber.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setModalNovo(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,8px))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a24a] text-[#003b26] shadow-lg sm:hidden"
        aria-label="Novo lançamento"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>
    </div>
  );
}
