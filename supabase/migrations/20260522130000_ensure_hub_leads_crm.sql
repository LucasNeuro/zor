-- Tabela hub_leads_crm (pipeline Vendas → Leads).
-- Base: lib/supabase/hub_migration_crm.sql

CREATE TABLE IF NOT EXISTS public.hub_leads_crm (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  telefone            TEXT,
  email               TEXT,
  origem              TEXT CHECK (origem IN ('whatsapp','instagram','meta_ads','google_ads','linkedin','site','indicacao','outro')),
  campanha            TEXT,
  anuncio_id          TEXT,
  estagio             TEXT DEFAULT 'novo' CHECK (estagio IN ('novo','qualificando','qualificado','proposta','negociando','fechamento','ganho','perdido')),
  score               INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  valor_estimado      NUMERIC(12,2) DEFAULT 0,
  agente_responsavel  TEXT,
  humano_responsavel  TEXT,
  proxima_acao        TEXT,
  data_proxima_acao   TIMESTAMPTZ,
  motivo_perda        TEXT,
  tags                TEXT[] DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',
  pessoa_id           UUID,
  tenant_id           UUID,
  ultimo_contato      TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pessoa_id UUID;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultimo_contato TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_estagio ON public.hub_leads_crm (estagio);
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_tenant ON public.hub_leads_crm (tenant_id);

COMMENT ON TABLE public.hub_leads_crm IS 'Leads do CRM operacional (Kanban Vendas).';

CREATE TABLE IF NOT EXISTS public.hub_atividades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  feito_por       TEXT NOT NULL DEFAULT 'humano',
  feito_por_tipo  TEXT NOT NULL DEFAULT 'humano',
  metadata        JSONB DEFAULT '{}',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_atividades_lead ON public.hub_atividades (lead_id, criado_em DESC);
