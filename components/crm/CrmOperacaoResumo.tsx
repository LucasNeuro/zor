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
    <div className="mb-6">
      <CrmSectionTitle>Operação · lead → negócio → obra</CrmSectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
    </div>
  );
}
