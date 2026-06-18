-- Rodar no Supabase se a migração automática ainda não aplicou.
-- Ver também: supabase/migrations/20260718120000_hub_ops_cobranca_storage.sql

ALTER TABLE public.hub_tenant_mensalidades
  ADD COLUMN IF NOT EXISTS boleto_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS boleto_arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS cora_status TEXT NOT NULL DEFAULT 'pendente_emissao',
  ADD COLUMN IF NOT EXISTS cora_erro TEXT,
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER,
  ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS whatsapp_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_telefone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_envio_erro TEXT;

CREATE TABLE IF NOT EXISTS public.hub_ops_cobranca_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensalidade_id UUID NOT NULL REFERENCES public.hub_tenant_mensalidades(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'erro')),
  mensagem TEXT,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hub_ops_cobranca_envios_mensalidade
  ON public.hub_ops_cobranca_envios (mensalidade_id, criado_em DESC);

ALTER TABLE public.hub_ops_cobranca_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_ops_cobranca_envios_service ON public.hub_ops_cobranca_envios;
CREATE POLICY hub_ops_cobranca_envios_service ON public.hub_ops_cobranca_envios
  FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_ops_cobranca_envios TO service_role;

-- Bucket Storage (PDF dos boletos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waje-ops-boletos',
  'waje-ops-boletos',
  true,
  5242880,
  ARRAY['application/pdf', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "waje_ops_boletos_select_public" ON storage.objects;
CREATE POLICY "waje_ops_boletos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'waje-ops-boletos');
