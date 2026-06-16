"use client";

import { useMemo } from "react";
import { filtrarTimelineMudancasStatus, type LeadTimelineEvent } from "@/lib/crm/lead-timeline";
import { LeadActivityFlow } from "@/components/crm/leads/LeadActivityFlow";
import type { CrmSideoverTheme } from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  leadNome?: string;
  events: LeadTimelineEvent[];
  loading?: boolean;
  theme?: CrmSideoverTheme;
  compact?: boolean;
  className?: string;
};

/** Linha do tempo filtrada: mudanças de funil comercial e status de atendimento. */
export function LeadStatusTimelineTab({
  leadNome,
  events,
  loading = false,
  theme = "light",
  compact = false,
  className = "",
}: Props) {
  const statusEvents = useMemo(() => filtrarTimelineMudancasStatus(events), [events]);

  return (
    <LeadActivityFlow
      events={statusEvents}
      loading={loading}
      theme={theme}
      compact={compact}
      leadNome={leadNome}
      className={className}
      lockCategory="estagio"
      headerTitle="Histórico de status"
      headerSubtitle="Funil comercial e estágios de atendimento"
      showExport
    />
  );
}
