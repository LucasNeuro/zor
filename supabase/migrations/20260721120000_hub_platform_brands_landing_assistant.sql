-- Assistente flutuante de captura de leads na landing (por marca white-label).

ALTER TABLE public.hub_platform_brands
  ADD COLUMN IF NOT EXISTS landing_assistant_ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.hub_platform_brands.landing_assistant_ativo IS
  'Exibe o widget de formulário de leads (mini-bot) na landing desta marca.';
