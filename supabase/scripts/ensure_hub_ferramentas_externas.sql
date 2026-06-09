-- Script manual (SQL Editor) — espelha 20260621200000_hub_ferramentas_externas.sql

CREATE TABLE IF NOT EXISTS public.hub_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  integracao_id text NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_integracoes_tipo_check CHECK (
    integracao_id IN ('webhook_generico', 'google_calendar', 'gmail', 'zendesk')
  ),
  CONSTRAINT hub_integracoes_status_check CHECK (
    status IN ('ativo', 'em_breve', 'erro', 'pendente_configuracao')
  )
);

CREATE INDEX IF NOT EXISTS idx_hub_integracoes_tenant ON public.hub_integracoes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_integracoes_tenant_tipo ON public.hub_integracoes (tenant_id, integracao_id);

CREATE TABLE IF NOT EXISTS public.hub_integracao_credenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  integracao_id uuid NOT NULL REFERENCES public.hub_integracoes (id) ON DELETE CASCADE,
  tipo_auth text NOT NULL DEFAULT 'api_key',
  credenciais jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_integracao_credenciais_tipo_auth_check CHECK (
    tipo_auth IN ('api_key', 'bearer', 'oauth_placeholder')
  ),
  CONSTRAINT hub_integracao_credenciais_integracao_unique UNIQUE (integracao_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_integracao_credenciais_tenant ON public.hub_integracao_credenciais (tenant_id);

CREATE TABLE IF NOT EXISTS public.hub_ferramentas_externas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  ferramenta_key text NOT NULL,
  titulo text NOT NULL,
  descricao_curta text,
  descricao_modelo text NOT NULL,
  integracao_id uuid NOT NULL REFERENCES public.hub_integracoes (id) ON DELETE RESTRICT,
  metodo_http text NOT NULL DEFAULT 'GET',
  url_template text NOT NULL,
  headers_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_template text,
  parametros_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  politica text NOT NULL DEFAULT 'leitura',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_ferramentas_externas_key_unique UNIQUE (tenant_id, ferramenta_key),
  CONSTRAINT hub_ferramentas_externas_key_format CHECK (ferramenta_key ~ '^hub_ext_[a-z0-9_]{1,48}$'),
  CONSTRAINT hub_ferramentas_externas_metodo_check CHECK (
    metodo_http IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
  ),
  CONSTRAINT hub_ferramentas_externas_politica_check CHECK (politica IN ('leitura', 'escrita'))
);

CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_externas_tenant ON public.hub_ferramentas_externas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_externas_tenant_ativo ON public.hub_ferramentas_externas (tenant_id, ativo);
