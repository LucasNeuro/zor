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
      <CrmSectionTitle>Operação comercial</CrmSectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
        <CrmMetricCard
          label="Negócios abertos"
          valor={operacao.negociosAbertos}
          sub="pipeline comercial"
          tone="success"
          href="/crm/negocios"
          loading={loading}
        />
        <CrmMetricCard
          label="Conversas ativas"
          valor={operacao.conversasAtivas}
          sub="WhatsApp e canais"
          tone="brand"
          href="/crm/atendimentos"
          loading={loading}
        />
        <CrmMetricCard
          label="Leads em atendimento"
          valor={operacao.leadsAtivos}
          sub="fora de ganho/perda"
          tone="success"
          href="/crm/leads"
          loading={loading}
        />
      </div>
    </section>
  );
}
