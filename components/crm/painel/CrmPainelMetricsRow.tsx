"use client";

import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import type { PainelKpiCard } from "@/lib/crm/painel-tabs";
import { painelKpiProgressPct } from "@/lib/crm/painel-metric-progress";

type Props = {
  kpis: PainelKpiCard[];
  loading?: boolean;
};

export function CrmPainelMetricsRow({ kpis, loading }: Props) {
  const count = kpis.length > 0 ? kpis.length : 4;
  if (!loading && kpis.length === 0) return null;

  return (
    <CrmMetricsGrid cols={4} className="mb-4">
      {loading
        ? Array.from({ length: count }).map((_, i) => (
            <CrmMetricCard key={`skel-${i}`} label="—" valor="—" loading />
          ))
        : kpis.map((kpi) => (
            <CrmMetricCard
              key={kpi.key}
              label={kpi.label}
              valor={kpi.valor}
              tone={kpi.tone}
              progress={{
                value: painelKpiProgressPct(kpi),
                max: 100,
                hint: kpi.sub,
              }}
            />
          ))}
    </CrmMetricsGrid>
  );
}
