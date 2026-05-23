-- Controle de acesso da empresa no CRM (habilitado ao cadastrar).

ALTER TABLE public.hub_empresas
  ADD COLUMN IF NOT EXISTS acesso_habilitado BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.hub_empresas
  ADD COLUMN IF NOT EXISTS acesso_habilitado_em TIMESTAMPTZ;

UPDATE public.hub_empresas
SET
  acesso_habilitado = COALESCE(acesso_habilitado, true),
  acesso_habilitado_em = COALESCE(acesso_habilitado_em, criado_em, NOW())
WHERE acesso_habilitado_em IS NULL AND COALESCE(acesso_habilitado, true) = true;

CREATE INDEX IF NOT EXISTS idx_hub_empresas_acesso ON public.hub_empresas (acesso_habilitado);
