-- SQL Editor manual — espelha 20260802100000_hub_integracoes_supabase_externo.sql

ALTER TABLE public.hub_integracoes
  DROP CONSTRAINT IF EXISTS hub_integracoes_tipo_check;

ALTER TABLE public.hub_integracoes
  ADD CONSTRAINT hub_integracoes_tipo_check CHECK (
    integracao_id IN (
      'webhook_generico',
      'google_calendar',
      'gmail',
      'zendesk',
      'supabase_externo'
    )
  );
