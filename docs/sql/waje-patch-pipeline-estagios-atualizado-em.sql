-- Patch: colunas opcionais em hub_pipeline_estagios (corrige toggle ACTIVO / PATCH estágios)
-- Erro típico: Could not find the 'atualizado_em' column of 'hub_pipeline_estagios' in the schema cache

ALTER TABLE public.hub_pipeline_estagios
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.hub_pipeline_estagios
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.hub_pipeline_estagios
  ADD COLUMN IF NOT EXISTS sistema BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.hub_pipeline_estagios
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.hub_pipeline_estagios.ativo IS 'false = oculta coluna no kanban';

-- Depois: Settings → API → Reload schema
