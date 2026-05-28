-- Cole TUDO no SQL Editor do Supabase e execute (Run).
-- Depois: Project Settings → API → Reload schema.

-- === 1) Tabelas financeiras ===
-- (conteúdo de supabase/migrations/20260529210000_ensure_hub_financeiro_tables.sql)

CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.hub_contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  fornecedor_empresa_id UUID,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  negocio_id UUID,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS hub_contas_pagar_ts ON public.hub_contas_pagar;
CREATE TRIGGER hub_contas_pagar_ts
  BEFORE UPDATE ON public.hub_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

DROP TRIGGER IF EXISTS hub_contas_receber_ts ON public.hub_contas_receber;
CREATE TRIGGER hub_contas_receber_ts
  BEFORE UPDATE ON public.hub_contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

CREATE INDEX IF NOT EXISTS idx_hub_contas_pagar_venc ON public.hub_contas_pagar (vencimento);
CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_venc ON public.hub_contas_receber (vencimento);

ALTER TABLE public.hub_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_contas_pagar_service ON public.hub_contas_pagar;
CREATE POLICY hub_contas_pagar_service ON public.hub_contas_pagar FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_contas_receber_service ON public.hub_contas_receber;
CREATE POLICY hub_contas_receber_service ON public.hub_contas_receber FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.hub_contas_pagar TO anon, authenticated, service_role;
GRANT ALL ON public.hub_contas_receber TO anon, authenticated, service_role;

-- === 2) Colunas tenant_id ===
-- (conteúdo de supabase/migrations/20260529200000_ensure_tenant_id_crm_relatorios.sql)

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
