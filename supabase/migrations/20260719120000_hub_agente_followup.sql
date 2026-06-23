-- Follow-up automático por agente WhatsApp (passos, imagens, cadência por silêncio do cliente).

-- Campos de estado no lead (idempotente — podem já existir em ambientes legados)
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS followup_passo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS followup_pausado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultimo_followup TIMESTAMPTZ;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS proximo_followup TIMESTAMPTZ;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultima_msg_cliente_em TIMESTAMPTZ;

COMMENT ON COLUMN public.hub_leads_crm.ultima_msg_cliente_em IS
  'Última mensagem recebida do cliente (WhatsApp). Relógio para follow-up automático.';

CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_followup_agente
  ON public.hub_leads_crm (agente_responsavel, followup_pausado)
  WHERE agente_responsavel IS NOT NULL;

-- Configuração por agente (1:1)
CREATE TABLE IF NOT EXISTS public.hub_agente_followup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  arquivar_apos_dias INTEGER NOT NULL DEFAULT 7
    CHECK (arquivar_apos_dias >= 1 AND arquivar_apos_dias <= 365),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_followup_config_slug_uniq UNIQUE (agente_slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_followup_config_tenant
  ON public.hub_agente_followup_config (tenant_id);

-- Passos da cadência (CRUD pelo CRM)
CREATE TABLE IF NOT EXISTS public.hub_agente_followup_passo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.hub_agente_followup_config(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  ordem INTEGER NOT NULL CHECK (ordem >= 1 AND ordem <= 24),
  atraso_horas INTEGER NOT NULL CHECK (atraso_horas >= 1 AND atraso_horas <= 8760),
  tipo_conteudo TEXT NOT NULL DEFAULT 'texto'
    CHECK (tipo_conteudo IN ('texto', 'imagem', 'texto_imagem')),
  texto_template TEXT,
  imagem_url TEXT,
  legenda_imagem TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_agente_followup_passo_ordem_uniq UNIQUE (config_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_followup_passo_agente
  ON public.hub_agente_followup_passo (agente_slug, ordem);

DROP TRIGGER IF EXISTS trg_hub_agente_followup_config_updated ON public.hub_agente_followup_config;
CREATE TRIGGER trg_hub_agente_followup_config_updated
  BEFORE UPDATE ON public.hub_agente_followup_config
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

DROP TRIGGER IF EXISTS trg_hub_agente_followup_passo_updated ON public.hub_agente_followup_passo;
CREATE TRIGGER trg_hub_agente_followup_passo_updated
  BEFORE UPDATE ON public.hub_agente_followup_passo
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- Bucket para imagens de follow-up (leitura pública para UAZAPI fetch)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-followup',
  'agent-followup',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "agent_followup_select_public" ON storage.objects;
CREATE POLICY "agent_followup_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'agent-followup');

COMMENT ON TABLE public.hub_agente_followup_config IS
  'Follow-up automático WhatsApp por agente — ativação e regras globais.';
COMMENT ON TABLE public.hub_agente_followup_passo IS
  'Passos de lembrete: atraso em horas desde última mensagem do cliente.';
