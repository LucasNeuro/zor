-- Garante tenant_id em tabelas usadas por /crm/relatorios e RLS multi-tenant.
-- Idempotente: seguro em projetos onde CREATE TABLE antigo não incluía a coluna.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

DO $$
DECLARE
  t uuid := public.default_obra10_tenant_id();
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_negocios') THEN
    ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_negocios SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_empresas') THEN
    ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_empresas SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_empresas_tenant ON public.hub_empresas (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_imoveis') THEN
    ALTER TABLE public.hub_imoveis ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_imoveis SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_imoveis_tenant ON public.hub_imoveis (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar') THEN
    ALTER TABLE public.hub_contas_pagar ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_contas_pagar SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_contas_pagar_tenant ON public.hub_contas_pagar (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_receber') THEN
    ALTER TABLE public.hub_contas_receber ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_contas_receber SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_tenant ON public.hub_contas_receber (tenant_id);
  END IF;
END $$;

-- FK opcional (só se hub_tenants existir e constraint ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_negocios_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_negocios
      ADD CONSTRAINT hub_negocios_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_empresas_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_empresas' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_empresas
      ADD CONSTRAINT hub_empresas_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_imoveis_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_imoveis' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_imoveis
      ADD CONSTRAINT hub_imoveis_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_contas_pagar_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_contas_pagar
      ADD CONSTRAINT hub_contas_pagar_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_contas_receber_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_contas_receber' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_contas_receber
      ADD CONSTRAINT hub_contas_receber_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'FK tenant_id: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.hub_negocios.tenant_id IS 'Tenant Obra10+ (multi-tenant).';
