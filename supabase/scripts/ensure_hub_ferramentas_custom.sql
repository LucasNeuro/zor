-- Garante tabela hub_ferramentas_custom com todas as colunas (incl. builtin_impl).
-- Execute no SQL Editor do Supabase se aparecer erro de schema cache em builtin_impl.

CREATE TABLE IF NOT EXISTS public.hub_ferramentas_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  ferramenta_key text NOT NULL,
  titulo text NOT NULL,
  descricao_modelo text NOT NULL,
  builtin_impl text NOT NULL DEFAULT 'hub_lead_resumo',
  parametros_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  smart_provider text NOT NULL DEFAULT 'none',
  smart_model text,
  smart_prompt text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_ferramentas_custom_key_unique UNIQUE (tenant_id, ferramenta_key),
  CONSTRAINT hub_ferramentas_custom_key_format CHECK (ferramenta_key ~ '^hub_custom_[a-z0-9_]{1,48}$')
);

ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS builtin_impl text;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS descricao_curta text;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS parametros_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS smart_provider text NOT NULL DEFAULT 'none';
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS smart_model text;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS smart_prompt text;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hub_ferramentas_custom ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

UPDATE public.hub_ferramentas_custom
SET builtin_impl = 'hub_lead_resumo'
WHERE builtin_impl IS NULL OR trim(builtin_impl) = '';

ALTER TABLE public.hub_ferramentas_custom
  ALTER COLUMN builtin_impl SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant ON public.hub_ferramentas_custom (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant_ativo ON public.hub_ferramentas_custom (tenant_id, ativo);
