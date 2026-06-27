-- Lembretes WhatsApp antes de eventos Google Calendar (independente da cadência de silêncio).

CREATE TABLE IF NOT EXISTS public.hub_agente_agenda_lembrete_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  minutos_antes INTEGER NOT NULL DEFAULT 10
    CHECK (minutos_antes >= 1 AND minutos_antes <= 1440),
  texto_template TEXT NOT NULL DEFAULT
    'Oi {nome}, lembrando: sua reunião com {agente} começa às {hora}. Link: {link_meet}',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_agenda_lembrete_config_slug_uniq UNIQUE (agente_slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_agenda_lembrete_config_tenant
  ON public.hub_agente_agenda_lembrete_config (tenant_id);

CREATE INDEX IF NOT EXISTS idx_hub_agente_agenda_lembrete_config_ativo
  ON public.hub_agente_agenda_lembrete_config (ativo)
  WHERE ativo = true;

COMMENT ON TABLE public.hub_agente_agenda_lembrete_config IS
  'Lembrete WhatsApp X minutos antes de google_calendar_reservas — não altera follow-up de silêncio.';

CREATE TABLE IF NOT EXISTS public.hub_agenda_lembrete_envio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  agente_slug TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agenda_lembrete_envio_lead_event_uniq UNIQUE (lead_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_agenda_lembrete_envio_agente
  ON public.hub_agenda_lembrete_envio (agente_slug, enviado_em DESC);

COMMENT ON TABLE public.hub_agenda_lembrete_envio IS
  'Ledger de lembretes de agenda enviados (1x por lead + event_id).';

DROP TRIGGER IF EXISTS trg_hub_agente_agenda_lembrete_config_updated ON public.hub_agente_agenda_lembrete_config;
CREATE TRIGGER trg_hub_agente_agenda_lembrete_config_updated
  BEFORE UPDATE ON public.hub_agente_agenda_lembrete_config
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
