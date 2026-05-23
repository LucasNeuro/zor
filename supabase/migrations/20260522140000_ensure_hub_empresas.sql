-- Cadastro CRM: hub_empresas (gaveta Cadastros → Empresas).

CREATE TABLE IF NOT EXISTS public.hub_empresas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT,
  razao_social      TEXT NOT NULL,
  nome_fantasia     TEXT,
  cnpj              TEXT,
  email             TEXT,
  telefone          TEXT,
  segmento          TEXT,
  prefixo_mercado   TEXT NOT NULL,
  cep               TEXT,
  logradouro        TEXT,
  bairro            TEXT,
  cidade            TEXT,
  estado            TEXT,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  tenant_id         UUID,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS bairro TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hub_empresas_codigo_unique
  ON public.hub_empresas (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE UNIQUE INDEX IF NOT EXISTS hub_empresas_cnpj_unique
  ON public.hub_empresas (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

CREATE INDEX IF NOT EXISTS idx_hub_empresas_ativo ON public.hub_empresas (ativo);
CREATE INDEX IF NOT EXISTS idx_hub_empresas_tenant ON public.hub_empresas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_empresas_razao ON public.hub_empresas (razao_social);

COMMENT ON TABLE public.hub_empresas IS 'Empresas PJ do CRM (clientes, fornecedores, parceiros).';
