-- Idempotente: tabelas/colunas de Atendimento CRM (Equipe + funil estagio_atendimento).
-- Cole no Supabase → SQL Editor → Run (uma vez).
-- Equivalente às migrações:
--   20260621210000_hub_atendentes_crm.sql
--   20260621230000_atendimento_pipeline_estagio.sql

-- ── Função de timestamp (se ainda não existir) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- ── Equipe: vendedores / atendentes humanos ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_atendentes_crm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  slug TEXT,
  email TEXT,
  cargo TEXT,
  agente_slug TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_atendentes_crm_telefone_chk CHECK (char_length(trim(telefone)) >= 10),
  CONSTRAINT hub_atendentes_crm_nome_chk CHECK (char_length(trim(nome)) >= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_atendentes_crm_tenant_telefone
  ON public.hub_atendentes_crm (tenant_id, telefone);

CREATE INDEX IF NOT EXISTS idx_hub_atendentes_crm_tenant_ativo
  ON public.hub_atendentes_crm (tenant_id, ativo, nome);

COMMENT ON TABLE public.hub_atendentes_crm IS
  'Cadastro de vendedores/atendentes humanos para transferência de conversa (grupo WhatsApp).';

ALTER TABLE public.hub_atendentes_crm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_acesso_total" ON public.hub_atendentes_crm;
CREATE POLICY "hub_acesso_total" ON public.hub_atendentes_crm FOR ALL USING (true);

DROP TRIGGER IF EXISTS hub_atendentes_crm_ts ON public.hub_atendentes_crm;
CREATE TRIGGER hub_atendentes_crm_ts
  BEFORE UPDATE ON public.hub_atendentes_crm
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_atendentes_crm TO anon, authenticated, service_role;

-- ── Funil de atendimento no lead ───────────────────────────────────────────
ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS estagio_atendimento TEXT DEFAULT 'novo';

COMMENT ON COLUMN public.hub_leads_crm.estagio_atendimento IS
  'Estágio no funil de atendimento (novo, em_andamento, aguardando, fechado).';

ALTER TABLE public.hub_pipelines DROP CONSTRAINT IF EXISTS hub_pipelines_tipo_check;
ALTER TABLE public.hub_pipelines
  ADD CONSTRAINT hub_pipelines_tipo_check CHECK (tipo IN ('lead', 'negocio', 'atendimento'));

UPDATE public.hub_leads_crm l
SET estagio_atendimento = 'novo'
WHERE (estagio_atendimento IS NULL OR TRIM(estagio_atendimento) = '')
  AND (
    EXISTS (SELECT 1 FROM public.hub_fila_mensagens f WHERE f.lead_id = l.id)
    OR (l.humano_responsavel IS NOT NULL AND TRIM(l.humano_responsavel) <> '')
    OR (l.agente_responsavel IS NOT NULL AND TRIM(l.agente_responsavel) <> '')
  );

-- ── View enriquecida (Leads + Atendimento) ─────────────────────────────────
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pessoa_id UUID;

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS estado TEXT;

CREATE INDEX IF NOT EXISTS idx_hub_fila_mensagens_lead_criado
  ON public.hub_fila_mensagens (lead_id, criado_em DESC NULLS LAST);

DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;

CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''::text), p.email) AS email_exibicao,
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

GRANT SELECT ON public.vw_hub_leads_crm_enriquecido TO anon, authenticated, service_role;

COMMENT ON VIEW public.vw_hub_leads_crm_enriquecido IS
  'hub_leads_crm + pessoa + última mensagem da fila WhatsApp.';

-- Recarrega cache do PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
