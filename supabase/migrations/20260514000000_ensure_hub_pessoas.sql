-- Tabela base hub_pessoas (cadastro CRM PF/PJ).
-- Pré-requisito para 20260515120000_vw_hub_leads_crm_enriquecido e 20260521130000_hub_pessoas_area_endereco.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.hub_pessoas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT,
  nome            TEXT NOT NULL,
  telefone        TEXT,
  email           TEXT,
  documento       TEXT,
  tipo            TEXT NOT NULL DEFAULT 'lead',
  tipo_pessoa     TEXT,
  empresa         TEXT,
  origem          TEXT,
  area_atuacao    TEXT,
  cep             TEXT,
  logradouro      TEXT,
  bairro          TEXT,
  cidade          TEXT,
  estado          TEXT,
  tenant_id       UUID,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_pessoas_tipo_pessoa_chk
    CHECK (tipo_pessoa IS NULL OR tipo_pessoa IN ('PF', 'PJ'))
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_pessoas_telefone_unique
  ON public.hub_pessoas (telefone)
  WHERE telefone IS NOT NULL AND telefone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS hub_pessoas_documento_unique
  ON public.hub_pessoas (documento)
  WHERE documento IS NOT NULL AND documento <> '';

CREATE INDEX IF NOT EXISTS idx_hub_pessoas_tipo_pessoa ON public.hub_pessoas (tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_hub_pessoas_tenant ON public.hub_pessoas (tenant_id);

COMMENT ON TABLE public.hub_pessoas IS 'Pessoas/contatos do CRM (clientes PF/PJ, leads, parceiros).';
