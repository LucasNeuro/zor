-- Execute no SQL Editor Supabase: harness v0.3 (sessões, skills, memória, delegações).
-- Script completo consolidado: apply_harness_superagente_completo.sql
-- Ou copie apenas este bloco (sem FTS):

-- ── Harness platform ───────────────────────────────────────────────────────
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

CREATE TABLE IF NOT EXISTS public.hub_agente_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'operacional' CHECK (target IN ('operacional', 'utilizador', 'atendimento')),
  conteudo TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_memory_tenant_agente_target_uniq UNIQUE (tenant_id, agente_slug, target)
);

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

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS harness_version TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_agente_skills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_agente_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_delegations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_harness_pending_writes TO service_role;
