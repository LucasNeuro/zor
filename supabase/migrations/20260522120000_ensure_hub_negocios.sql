-- Cadastro CRM: hub_negocios (negócios na gaveta Vendas).
-- lead_id e pessoa_id opcionais para criação manual.

CREATE TABLE IF NOT EXISTS public.hub_negocios (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                      TEXT,
  titulo                      TEXT NOT NULL,
  descricao                   TEXT,
  tipo                        TEXT,
  prefixo_mercado             TEXT NOT NULL,
  lead_id                     UUID,
  pessoa_id                   UUID,
  valor_estimado              NUMERIC(12,2),
  valor_fechado               NUMERIC(12,2),
  percentual_comissao         NUMERIC(5,2) DEFAULT 0,
  comissao_calculada          NUMERIC(12,2),
  status                      TEXT NOT NULL DEFAULT 'aberto',
  etapa                       TEXT NOT NULL DEFAULT 'briefing',
  data_previsao_fechamento    DATE,
  data_fechamento             DATE,
  tenant_id                   UUID,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_negocios_status_chk
    CHECK (status IN ('aberto','em_negociacao','fechado_ganho','fechado_perdido','cancelado')),
  CONSTRAINT hub_negocios_etapa_chk
    CHECK (etapa IN ('briefing','match','sit-down','concluido'))
);

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pessoa_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN lead_id DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'pessoa_id'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN pessoa_id DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hub_negocios_codigo_unique
  ON public.hub_negocios (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE INDEX IF NOT EXISTS idx_hub_negocios_etapa ON public.hub_negocios (etapa);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_status ON public.hub_negocios (status);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);

COMMENT ON TABLE public.hub_negocios IS 'Negócios/oportunidades do CRM (gaveta Vendas).';
