-- =============================================================================
-- HARNESS SUPERAGENTE INTERNO — aplicar no Supabase SQL Editor (Run)
-- Ordem: 1) briefing (se ainda não existir) → 2) harness platform → 3) FTS
-- =============================================================================

-- ── PRÉ-REQUISITO: tabelas briefing (copiloto) ─────────────────────────────
-- Se já aplicou ensure_hub_briefing_chat_tables.sql, pode saltar este bloco.

CREATE TABLE IF NOT EXISTS public.hub_crm_agente_briefing_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug text NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON UPDATE CASCADE ON DELETE CASCADE,
  titulo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_crm_agente_briefing_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.hub_crm_agente_briefing_sessao(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  conteudo text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_crm_agente_briefing_sessao
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'briefing_interno';

-- ── MIGRAÇÃO 1: Harness platform (v0.3) ─────────────────────────────────────
-- Equivalente: supabase/migrations/20260801100000_hub_harness_platform.sql

CREATE TABLE IF NOT EXISTS public.hub_harness_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN (
    'copiloto_crm', 'ciclo_programado', 'whatsapp_gestor',
    'whatsapp_lead', 'email_lead', 'interno'
  )),
  modo_id TEXT NOT NULL DEFAULT 'operar' CHECK (modo_id IN ('conversar', 'analisar', 'operar', 'planear')),
  thread_id UUID,
  resource_id TEXT,
  lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  grants JSONB NOT NULL DEFAULT '{}'::jsonb,
  pending_approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  harness_version TEXT NOT NULL DEFAULT '0.3.0',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_harness_sessions_tenant_agente
  ON public.hub_harness_sessions (tenant_id, agente_slug, atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_hub_harness_sessions_resource
  ON public.hub_harness_sessions (tenant_id, surface, resource_id)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hub_harness_sessions_active_uniq
  ON public.hub_harness_sessions (tenant_id, agente_slug, surface, COALESCE(resource_id, ''), COALESCE(lead_id::text, ''));

CREATE TABLE IF NOT EXISTS public.hub_agente_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  corpo_md TEXT NOT NULL DEFAULT '',
  ferramentas_sugeridas TEXT[] NOT NULL DEFAULT '{}',
  origem TEXT NOT NULL DEFAULT 'cargo_seed' CHECK (origem IN (
    'cargo_seed', 'wizard', 'agente', 'manual', 'background_review'
  )),
  ativo BOOLEAN NOT NULL DEFAULT true,
  versao TEXT NOT NULL DEFAULT '1.0.0',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_skills_tenant_agente_skill_uniq UNIQUE (tenant_id, agente_slug, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_skills_agente
  ON public.hub_agente_skills (tenant_id, agente_slug, ativo);

CREATE TABLE IF NOT EXISTS public.hub_agente_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'operacional' CHECK (target IN ('operacional', 'utilizador', 'atendimento')),
  conteudo TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_memory_tenant_agente_target_uniq UNIQUE (tenant_id, agente_slug, target)
);

CREATE TABLE IF NOT EXISTS public.hub_harness_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.hub_harness_sessions(id) ON DELETE SET NULL,
  agente_origem_slug TEXT NOT NULL,
  agente_destino_slug TEXT NOT NULL,
  lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL,
  surface_origem TEXT NOT NULL,
  brief TEXT NOT NULL,
  contexto_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  )),
  resultado_texto TEXT,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hub_harness_delegations_tenant
  ON public.hub_harness_delegations (tenant_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.hub_harness_pending_writes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  session_id UUID REFERENCES public.hub_harness_sessions(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('memory_patch', 'skill_patch', 'crm_write')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hub_harness_pending_writes_agente
  ON public.hub_harness_pending_writes (tenant_id, agente_slug, status);

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS harness_version TEXT;

CREATE OR REPLACE FUNCTION public.hub_harness_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_harness_sessions_updated ON public.hub_harness_sessions;
CREATE TRIGGER trg_hub_harness_sessions_updated
  BEFORE UPDATE ON public.hub_harness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.hub_harness_set_updated_at();

DROP TRIGGER IF EXISTS trg_hub_agente_skills_updated ON public.hub_agente_skills;
CREATE TRIGGER trg_hub_agente_skills_updated
  BEFORE UPDATE ON public.hub_agente_skills
  FOR EACH ROW EXECUTE FUNCTION public.hub_harness_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_agente_skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_agente_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_delegations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_pending_writes TO service_role;

-- ── MIGRAÇÃO 2: FTS briefing (harness_session_search) ───────────────────────
-- Equivalente: supabase/migrations/20260803100000_hub_briefing_mensagem_fts.sql

ALTER TABLE public.hub_crm_agente_briefing_mensagem
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_hub_briefing_mensagem_fts
  ON public.hub_crm_agente_briefing_mensagem
  USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.hub_briefing_mensagem_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.conteudo, '')), 'A');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_briefing_mensagem_fts ON public.hub_crm_agente_briefing_mensagem;
CREATE TRIGGER trg_hub_briefing_mensagem_fts
  BEFORE INSERT OR UPDATE OF conteudo ON public.hub_crm_agente_briefing_mensagem
  FOR EACH ROW EXECUTE FUNCTION public.hub_briefing_mensagem_search_vector_update();

UPDATE public.hub_crm_agente_briefing_mensagem
SET search_vector = setweight(to_tsvector('portuguese', coalesce(conteudo, '')), 'A')
WHERE search_vector IS NULL;

CREATE OR REPLACE FUNCTION public.hub_briefing_mensagem_search(
  p_agente_slug text,
  p_query text,
  p_limite integer DEFAULT 8
)
RETURNS TABLE (
  sessao_id uuid,
  papel text,
  conteudo text,
  trecho text,
  criado_em timestamptz,
  rank real
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.sessao_id,
    m.papel,
    m.conteudo,
    left(m.conteudo, 400) AS trecho,
    m.criado_em,
    ts_rank(m.search_vector, websearch_to_tsquery('portuguese', p_query)) AS rank
  FROM public.hub_crm_agente_briefing_mensagem m
  INNER JOIN public.hub_crm_agente_briefing_sessao s ON s.id = m.sessao_id
  WHERE s.agente_slug = p_agente_slug
    AND m.search_vector @@ websearch_to_tsquery('portuguese', p_query)
  ORDER BY rank DESC, m.criado_em DESC
  LIMIT greatest(1, least(p_limite, 24));
$$;

-- ── OPCIONAL: write_approval por tenant ─────────────────────────────────────
-- Descomente e substitua TENANT_UUID pelo id do tenant.

-- UPDATE public.hub_tenants
-- SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
--   'harness', jsonb_build_object(
--     'memory_write_approval', true,
--     'skills_write_approval', true
--   )
-- )
-- WHERE id = 'TENANT_UUID';

-- ── VERIFICAÇÃO (deve devolver linhas, sem erro) ────────────────────────────

SELECT 'hub_harness_sessions' AS tabela, count(*) AS linhas FROM public.hub_harness_sessions
UNION ALL
SELECT 'hub_agente_skills', count(*) FROM public.hub_agente_skills
UNION ALL
SELECT 'hub_agente_memory', count(*) FROM public.hub_agente_memory
UNION ALL
SELECT 'hub_harness_pending_writes', count(*) FROM public.hub_harness_pending_writes;

SELECT proname FROM pg_proc WHERE proname = 'hub_briefing_mensagem_search';
