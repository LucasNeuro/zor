-- SQL Editor manual — espelha 20260623150000_hub_tenant_agenda_config.sql

CREATE TABLE IF NOT EXISTS public.hub_tenant_agenda_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  duracao_reserva_min integer NOT NULL DEFAULT 90,
  abertura text NOT NULL DEFAULT '11:30',
  fechamento text NOT NULL DEFAULT '23:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  com_meet boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_tenant_agenda_config_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT hub_tenant_agenda_config_duracao_check CHECK (
    duracao_reserva_min >= 15 AND duracao_reserva_min <= 480
  ),
  CONSTRAINT hub_tenant_agenda_config_abertura_check CHECK (abertura ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT hub_tenant_agenda_config_fechamento_check CHECK (fechamento ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_agenda_config_tenant ON public.hub_tenant_agenda_config (tenant_id);
