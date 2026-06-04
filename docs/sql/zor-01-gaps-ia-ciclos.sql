-- =============================================================================
-- ZOR — tabelas usadas pelo código mas sem CREATE nas migrações do repo
-- Executar DEPOIS de zor-schema-completo.sql (ou quando CREATE falhar por tabela inexistente)
-- =============================================================================

-- ─── Hierarquia / fluxos / regras IA (router + engine) ───────────────────────
CREATE TABLE IF NOT EXISTS public.hub_hierarquia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  nivel_org INTEGER NOT NULL CHECK (nivel_org >= 1 AND nivel_org <= 5),
  area TEXT NOT NULL,
  superior_id UUID REFERENCES public.hub_hierarquia(id),
  avatar_url TEXT,
  cor TEXT DEFAULT '#f97316',
  responsabilidades TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  fluxos JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  nivel TEXT,
  agente_slug TEXT,
  supervisor_slug TEXT,
  subordinados JSONB DEFAULT '[]',
  criterios_escalonamento TEXT,
  limite_autonomia_brl NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hub_fluxos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area TEXT NOT NULL,
  descricao TEXT,
  etapas JSONB NOT NULL DEFAULT '[]',
  responsaveis JSONB NOT NULL DEFAULT '[]',
  gatilhos JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  agente_slug TEXT,
  fase TEXT,
  proximo_passo TEXT,
  acao_esperada TEXT,
  ativo BOOLEAN DEFAULT true,
  desativado_em TIMESTAMPTZ,
  desativado_motivo TEXT
);

CREATE TABLE IF NOT EXISTS public.hub_regras_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  condicao JSONB NOT NULL DEFAULT '{}',
  acao JSONB NOT NULL DEFAULT '{}',
  modelo_ia TEXT DEFAULT 'mistral-small-latest',
  ativo BOOLEAN DEFAULT true,
  aprendizado JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  agente_slug TEXT,
  instrucao TEXT,
  prioridade INTEGER DEFAULT 0
);

-- ─── Ciclos IA (automações /crm/ciclos) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_ciclos_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('continuo', 'programado', 'gatilho')),
  cron_expressao TEXT,
  intervalo_minutos INTEGER,
  ativo BOOLEAN DEFAULT true,
  ultimo_ciclo TIMESTAMPTZ,
  proximo_ciclo TIMESTAMPTZ,
  ultimo_status TEXT DEFAULT 'nunca_executado',
  ultimo_resultado JSONB DEFAULT '{}',
  total_execucoes INTEGER DEFAULT 0,
  total_alertas_gerados INTEGER DEFAULT 0,
  configuracoes JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_ciclos_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID REFERENCES public.hub_ciclos_ia(id) ON DELETE SET NULL,
  agente_slug TEXT NOT NULL,
  iniciado_em TIMESTAMPTZ DEFAULT NOW(),
  finalizado_em TIMESTAMPTZ,
  status TEXT DEFAULT 'rodando' CHECK (status IN ('rodando', 'sucesso', 'erro', 'sem_acao')),
  acoes_tomadas JSONB DEFAULT '[]',
  alertas_gerados JSONB DEFAULT '[]',
  erro TEXT,
  tokens_usados INTEGER DEFAULT 0,
  custo_brl NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hub_ciclos_ia_agente ON public.hub_ciclos_ia (agente_slug, ativo);
CREATE INDEX IF NOT EXISTS idx_hub_ciclos_log_ciclo ON public.hub_ciclos_log (ciclo_id, iniciado_em DESC);

-- ─── Catálogos (CRM agentes — se migrations não criaram) ─────────────────────
CREATE TABLE IF NOT EXISTS public.hub_cargos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  area TEXT,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_mercados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  prefixo TEXT,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_perfis_personalidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
