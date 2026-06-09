import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";

export type CrmResumoLead = {
  id: string;
  nome: string;
  telefone: string | null;
  estagio: string;
  estagio_funil?: string | null;
  metadata?: unknown;
  criado_em: string;
};

export type CrmResumoNegocio = {
  id: string;
  codigo: string | null;
  titulo: string;
  etapa: string;
  status: string;
  valor_estimado?: number | null;
  lead_id?: string | null;
  criado_em: string;
};

export type ClienteCrmResumo = {
  leads: CrmResumoLead[];
  negocios: CrmResumoNegocio[];
  timeline_events: LeadTimelineEvent[];
};
