-- Trial + Cora em mensalidades (console Waje Owner). Idempotente.
-- Ver também: supabase/migrations/20260717140000_hub_tenant_trial_cora.sql

ALTER TABLE public.hub_tenants
  ADD COLUMN IF NOT EXISTS trial_ate TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hub_tenants_trial_ate
  ON public.hub_tenants (trial_ate)
  WHERE trial_ate IS NOT NULL AND ativo = true;

ALTER TABLE public.hub_tenant_mensalidades
  ADD COLUMN IF NOT EXISTS cora_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS cora_boleto_url TEXT,
  ADD COLUMN IF NOT EXISTS cora_pix_emv TEXT,
  ADD COLUMN IF NOT EXISTS cora_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
