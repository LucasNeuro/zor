-- OBRA10: tabelas mínimas para CRM + atendimento + dashboard (idempotente).

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;

-- ─── Agentes IA ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_agente_identidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  system_prompt_base TEXT NOT NULL DEFAULT '',
  modelo_padrao TEXT DEFAULT 'haiku',
  ativo BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.hub_agente_identidade (agente_slug, nome, system_prompt_base, ativo, tenant_id)
VALUES
  ('sdr', 'SDR Comercial', 'Atendimento comercial Obra10+.', true, public.default_obra10_tenant_id()),
  ('wendel', 'Operador CRM', 'Suporte humano no CRM.', true, public.default_obra10_tenant_id())
ON CONFLICT (agente_slug) DO NOTHING;

-- ─── Fila WhatsApp / CRM ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_fila_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  conversa_id UUID,
  agente_id TEXT,
  agente_responsavel TEXT,
  canal TEXT DEFAULT 'whatsapp',
  direcao TEXT NOT NULL DEFAULT 'entrada' CHECK (direcao IN ('entrada','saida')),
  conteudo TEXT,
  status TEXT DEFAULT 'pendente',
  metadata JSONB DEFAULT '{}',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  enviada_em TIMESTAMPTZ,
  resposta_enviada BOOLEAN DEFAULT false,
  agendado_para TIMESTAMPTZ,
  remetente_numero TEXT,
  whatsapp_message_id TEXT,
  tentativas INTEGER DEFAULT 0,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.hub_leads_crm') IS NOT NULL THEN
    ALTER TABLE public.hub_fila_mensagens DROP CONSTRAINT IF EXISTS hub_fila_mensagens_lead_id_fkey;
    ALTER TABLE public.hub_fila_mensagens
      ADD CONSTRAINT hub_fila_mensagens_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fila lead fk: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_hub_fila_lead_criado ON public.hub_fila_mensagens (lead_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_fila_status_dir ON public.hub_fila_mensagens (status, direcao);

ALTER TABLE public.hub_fila_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_fila_mensagens_anon ON public.hub_fila_mensagens;
CREATE POLICY hub_fila_mensagens_anon ON public.hub_fila_mensagens
  FOR ALL TO anon
  USING (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id());

-- ─── Aprovações (schema operacional IA + UI) ──────────────────────────────────
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS agente_slug TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS agente_nome TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS impacto TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS recomendacao TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS confianca_ia NUMERIC(5,2) DEFAULT 85;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS valor_envolvido NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS dados JSONB DEFAULT '{}';
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS aprovado_por TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS rejeitado_por TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS observacao TEXT;

UPDATE public.hub_aprovacoes
SET
  descricao = COALESCE(NULLIF(TRIM(descricao), ''), titulo, 'Aprovação'),
  agente_slug = COALESCE(agente_slug, solicitado_por, 'sdr'),
  motivo = COALESCE(motivo, descricao)
WHERE titulo IS NOT NULL OR descricao IS NOT NULL;

ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT IF EXISTS hub_aprovacoes_status_check;
ALTER TABLE public.hub_aprovacoes
  ADD CONSTRAINT hub_aprovacoes_status_check
  CHECK (status IN ('pendente','aprovado','rejeitado','aprovada','rejeitada','cancelada'));

UPDATE public.hub_aprovacoes SET status = 'aprovado' WHERE status = 'aprovada';
UPDATE public.hub_aprovacoes SET status = 'rejeitado' WHERE status = 'rejeitada';

-- ─── Parceiros (mínimo) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  especialidade TEXT,
  mercado TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT DEFAULT 'captacao',
  modulo_atual INTEGER DEFAULT 1,
  recebe_leads BOOLEAN DEFAULT false,
  total_leads_recebidos INTEGER DEFAULT 0,
  total_leads_convertidos INTEGER DEFAULT 0,
  comissao_pct NUMERIC(5,2) DEFAULT 5,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_captacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  estagio TEXT DEFAULT 'interessado',
  origem TEXT,
  canal TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_homologacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  estagio TEXT DEFAULT 'em_andamento',
  modulos_concluidos INTEGER DEFAULT 0,
  data_conclusao TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  modulo_numero INTEGER NOT NULL,
  status TEXT DEFAULT 'pendente',
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT,
  feito_por TEXT DEFAULT 'sistema',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  status TEXT DEFAULT 'ativo',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_encaminhamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  encaminhado_para TEXT,
  encaminhado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES public.hub_tenants(id)
);

CREATE TABLE IF NOT EXISTS public.hub_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT,
  tipo TEXT,
  descricao TEXT,
  lead_id UUID,
  valor_envolvido NUMERIC(12,2),
  aprovado_por TEXT,
  resultado TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT,
  tipo TEXT DEFAULT 'info',
  titulo TEXT NOT NULL,
  descricao TEXT,
  lido BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View leads enriquecida
DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;
CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

GRANT SELECT ON public.vw_hub_leads_crm_enriquecido TO anon, authenticated;
