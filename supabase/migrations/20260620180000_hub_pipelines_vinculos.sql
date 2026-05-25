-- Pipelines configuráveis (leads/negócios), estágios customizáveis e vínculos de negócio com rastreio por código.

-- ─── Pipelines ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('lead', 'negocio')),
  mercado_sigla   TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  tenant_id       UUID REFERENCES public.hub_tenants(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_pipelines_slug_tenant_unique
  ON public.hub_pipelines (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS idx_hub_pipelines_tipo ON public.hub_pipelines (tipo, ativo);

-- ─── Estágios por pipeline ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_pipeline_estagios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES public.hub_pipelines(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  label           TEXT NOT NULL,
  cor             TEXT NOT NULL DEFAULT '#6B7280',
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  tipo_fecho      TEXT NOT NULL DEFAULT 'aberto'
    CHECK (tipo_fecho IN ('aberto', 'ganho', 'perdido')),
  sistema         BOOLEAN NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_pipeline_estagios_pipeline
  ON public.hub_pipeline_estagios (pipeline_id, ordem);

-- ─── Vínculos negócio ↔ entidades (PES, LED, EMP, PAR) ───────────────────────
CREATE TABLE IF NOT EXISTS public.hub_negocio_vinculos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES public.hub_negocios(id) ON DELETE CASCADE,
  entidade_tipo   TEXT NOT NULL
    CHECK (entidade_tipo IN ('pessoa', 'empresa', 'parceiro', 'lead')),
  entidade_id     UUID NOT NULL,
  codigo_rastreio TEXT,
  papel           TEXT NOT NULL DEFAULT 'participante'
    CHECK (papel IN (
      'cliente', 'contato_principal', 'lead_origem', 'empresa',
      'parceiro', 'indicador', 'participante'
    )),
  tenant_id       UUID REFERENCES public.hub_tenants(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_negocio_vinculos_negocio
  ON public.hub_negocio_vinculos (negocio_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_negocio_vinculos_unique
  ON public.hub_negocio_vinculos (negocio_id, entidade_tipo, entidade_id, papel);

-- ─── Colunas pipeline nos registos ───────────────────────────────────────────
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pipeline_id UUID
  REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID
  REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;

-- Relaxar CHECK fixo de estágio/etapa (validação na app + hub_pipeline_estagios)
ALTER TABLE public.hub_leads_crm DROP CONSTRAINT IF EXISTS hub_leads_crm_estagio_chk;
ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_etapa_chk;

-- FK lead CRM em negócios (substitui referência legada hub_leads quando existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_negocios_lead_crm_fkey') THEN
    ALTER TABLE public.hub_negocios
      ADD CONSTRAINT hub_negocios_lead_crm_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Migrar etapas antigas de negócio para o funil unificado
UPDATE public.hub_negocios SET etapa = 'novo'         WHERE etapa = 'briefing';
UPDATE public.hub_negocios SET etapa = 'qualificado'  WHERE etapa = 'match';
UPDATE public.hub_negocios SET etapa = 'negociando'   WHERE etapa IN ('sit-down', 'sit_down');
UPDATE public.hub_negocios SET etapa = 'ganho'        WHERE etapa = 'concluido';

-- ─── Seed pipelines globais + 8 estágios padrão ──────────────────────────────
INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'leads-global', 'Leads — Pipeline global', 'lead', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM public.hub_pipelines WHERE slug = 'leads-global' AND tenant_id IS NULL);

INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'negocios-global', 'Negócios — Pipeline global', 'negocio', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.hub_pipelines WHERE slug = 'negocios-global' AND tenant_id IS NULL);

DO $$
DECLARE
  pid_lead UUID;
  pid_neg UUID;
BEGIN
  SELECT id INTO pid_lead FROM public.hub_pipelines WHERE slug = 'leads-global' AND tenant_id IS NULL LIMIT 1;
  SELECT id INTO pid_neg FROM public.hub_pipelines WHERE slug = 'negocios-global' AND tenant_id IS NULL LIMIT 1;

  IF pid_lead IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_lead, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
      ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
      ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
      ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
      ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
      ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
      ('ganho',        '✓ Ganhos',     '#22C55E', 6, 'ganho'),
      ('perdido',      '✗ Perdidos',   '#EF4444', 7, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;

    UPDATE public.hub_leads_crm SET pipeline_id = pid_lead WHERE pipeline_id IS NULL;
  END IF;

  IF pid_neg IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_neg, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
      ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
      ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
      ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
      ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
      ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
      ('ganho',        '✓ Ganhos',     '#22C55E', 6, 'ganho'),
      ('perdido',      '✗ Perdidos',   '#EF4444', 7, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;

    UPDATE public.hub_negocios SET pipeline_id = pid_neg WHERE pipeline_id IS NULL;
  END IF;
END $$;

-- RLS (mesmo padrão anon do CRM)
ALTER TABLE public.hub_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_pipeline_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_negocio_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_pipelines_anon ON public.hub_pipelines;
CREATE POLICY hub_pipelines_anon ON public.hub_pipelines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_pipeline_estagios_anon ON public.hub_pipeline_estagios;
CREATE POLICY hub_pipeline_estagios_anon ON public.hub_pipeline_estagios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_negocio_vinculos_anon ON public.hub_negocio_vinculos;
CREATE POLICY hub_negocio_vinculos_anon ON public.hub_negocio_vinculos FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_pipelines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_pipeline_estagios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_negocio_vinculos TO anon, authenticated;

COMMENT ON TABLE public.hub_pipelines IS 'Funis configuráveis (leads e negócios) por mercado ou global.';
COMMENT ON TABLE public.hub_pipeline_estagios IS 'Colunas/estágios de cada pipeline; ativo=false oculta no kanban.';
COMMENT ON TABLE public.hub_negocio_vinculos IS 'Participantes do negócio com código de rastreio (PES, LED, EMP, PAR).';
