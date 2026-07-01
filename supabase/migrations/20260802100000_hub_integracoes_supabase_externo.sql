-- Permite gravar integração Supabase externa (coexiste com CRM Waje via env da plataforma).

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

COMMENT ON CONSTRAINT hub_integracoes_tipo_check ON public.hub_integracoes IS
  'Tipos de integração por tenant; supabase_externo = segunda base Supabase opcional.';
