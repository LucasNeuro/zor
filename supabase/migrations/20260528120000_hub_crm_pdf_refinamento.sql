-- CRM PDF: colunas aditivas, logs, encaminhamento V2, vínculos pessoa–empresa.

CREATE TABLE IF NOT EXISTS public.hub_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  usuario_id UUID,
  origem TEXT DEFAULT 'crm',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_logs_entidade ON public.hub_logs (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_hub_logs_criado ON public.hub_logs (criado_em DESC);

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS estagio_funil TEXT;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS tipo_interesse TEXT;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS proxima_acao TEXT;

ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS negocio_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS destinatario_pessoa_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS destinatario_empresa_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS responsavel_envio TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS sugerido_ia BOOLEAN DEFAULT false;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS validado_humano BOOLEAN DEFAULT false;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aguardando_validacao';
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS criterio_selecao TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.hub_proximas_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  data_prevista TIMESTAMPTZ,
  responsavel_id UUID,
  concluida BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_pessoas_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES public.hub_pessoas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.hub_empresas(id) ON DELETE CASCADE,
  cargo TEXT,
  principal BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pessoa_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_pessoas_empresas_pessoa ON public.hub_pessoas_empresas (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_hub_pessoas_empresas_empresa ON public.hub_pessoas_empresas (empresa_id);
