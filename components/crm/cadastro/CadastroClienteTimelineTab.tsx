"use client";

import { LeadActivityFlow } from "@/components/crm/leads/LeadActivityFlow";
import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";
import { RF_TEXT_MUTED } from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  events: LeadTimelineEvent[];
  loading?: boolean;
  clienteNome?: string;
};

export function CadastroClienteTimelineTab({ events, loading, clienteNome }: Props) {
  if (loading) {
    return (
      <p style={{ color: RF_TEXT_MUTED, fontSize: 12, textAlign: "center", padding: "24px 0" }}>
        A carregar linha do tempo…
      </p>
    );
  }

  return (
    <LeadActivityFlow
      events={events}
      loading={loading}
      theme="dark"
      compact
      leadNome={clienteNome}
    />
  );
}
