"use client";

import { CrmMetricCard, CrmSectionTitle } from "@/components/crm/CrmMetricCard";
import type { OperacaoResumo } from "@/lib/crm/dashboard-aggregate";

export function CrmOperacaoResumo({
  operacao,
  loading,
}: {
  operacao: OperacaoResumo;
  loading: boolean;
}) {
  return (
    <section className="h-full rounded-2xl border border-[#dcebd8] bg-[#ffffff] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <CrmSectionTitle>Operação · lead → negócio → obra</CrmSectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
        <CrmMetricCard
          label="Negócios abertos"
          valor={operacao.negociosAbertos}
          sub="pipeline comercial"
          cor="#3b82f6"
          href="/crm/negocios"
          loading={loading}
        />
        <CrmMetricCard
          label="Obras em andamento"
          valor={operacao.obrasEmAndamento}
          sub="execução"
          cor="#22c55e"
          href="/crm/obras"
          loading={loading}
        />
        <CrmMetricCard
          label="Pedidos de material"
          valor={operacao.pedidosAbertos}
          sub="rascunho a aprovado"
          cor="#eab308"
          href="/crm/pedidos"
          loading={loading}
        />
      </div>
    </section>
  );
}
