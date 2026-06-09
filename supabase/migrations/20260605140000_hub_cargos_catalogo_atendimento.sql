-- Campos de atendimento externo (WhatsApp) no catálogo de cargos.

ALTER TABLE public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS saudacao_cliente TEXT,
  ADD COLUMN IF NOT EXISTS usar_perguntas_essenciais BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem_perguntas_essenciais TEXT NOT NULL DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS perguntas_essenciais TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS comprimento_padrao TEXT;
