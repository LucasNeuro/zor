-- =============================================================================
-- Waje — tabela hub_negocios (obrigatória para "Criar negócio" no lead)
-- Execute no Supabase SQL Editor → Run → Settings → API → Reload schema
--
-- Seguro para DB legado: se hub_negocios já existir sem prefixo_mercado / etapa Waje,
-- adiciona colunas antes de qualquer UPDATE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.hub_negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  prefixo_mercado TEXT DEFAULT 'GRL',
  lead_id UUID,
  pessoa_id UUID,
  empresa_id UUID,
  pipeline_id UUID,
  valor_estimado NUMERIC(12, 2),
  valor_fechado NUMERIC(12, 2),
  percentual_comissao NUMERIC(5, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  etapa TEXT NOT NULL DEFAULT 'novo',
  data_previsao_fechamento DATE,
  data_entrada DATE,
  data_entrega DATE,
  data_fechamento DATE,
  motivo_perda TEXT,
  proxima_acao TEXT,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Colunas Waje em tabela legada (CREATE IF NOT EXISTS não altera tabela antiga) ───
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS prefixo_mercado TEXT DEFAULT 'GRL';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pessoa_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS percentual_comissao NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'novo';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS proxima_acao TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_etapa_chk;
ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_status_chk;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'titulo'
  ) THEN
    UPDATE public.hub_negocios
    SET titulo = 'Negócio'
    WHERE titulo IS NULL OR btrim(titulo) = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'prefixo_mercado'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado DROP NOT NULL;
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado SET DEFAULT 'GRL';
    UPDATE public.hub_negocios
    SET prefixo_mercado = 'GRL'
    WHERE prefixo_mercado IS NULL OR btrim(prefixo_mercado) = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN lead_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'etapa'
  ) THEN
    UPDATE public.hub_negocios
    SET etapa = 'novo'
    WHERE etapa IN ('briefing', 'match', 'sit-down', 'sit_down', 'concluido');
    UPDATE public.hub_negocios SET etapa = 'novo' WHERE etapa IS NULL OR btrim(etapa) = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'status'
  ) THEN
    UPDATE public.hub_negocios SET status = 'aberto' WHERE status IS NULL OR btrim(status) = '';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hub_negocios_codigo_unique
  ON public.hub_negocios (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE INDEX IF NOT EXISTS idx_hub_negocios_etapa ON public.hub_negocios (etapa);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_status ON public.hub_negocios (status);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_lead_id ON public.hub_negocios (lead_id) WHERE lead_id IS NOT NULL;

DROP TRIGGER IF EXISTS hub_negocios_ts ON public.hub_negocios;
CREATE TRIGGER hub_negocios_ts
  BEFORE UPDATE ON public.hub_negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_negocios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_negocios_anon ON public.hub_negocios;
DROP POLICY IF EXISTS hub_negocios_service ON public.hub_negocios;
CREATE POLICY hub_negocios_service ON public.hub_negocios FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.hub_negocios TO anon, authenticated, service_role;

COMMENT ON TABLE public.hub_negocios IS 'Negócios/oportunidades do CRM Waje (vinculados a leads).';

NOTIFY pgrst, 'reload schema';
