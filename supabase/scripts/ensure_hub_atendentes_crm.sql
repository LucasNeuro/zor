-- Idempotente: hub_atendentes_crm (vendedores/atendentes para transferência WhatsApp).
-- Execute no SQL Editor se a migração 20260621210000 ainda não foi aplicada.

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

ALTER TABLE public.hub_atendentes_crm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hub_acesso_total" ON public.hub_atendentes_crm;
CREATE POLICY "hub_acesso_total" ON public.hub_atendentes_crm FOR ALL USING (true);
