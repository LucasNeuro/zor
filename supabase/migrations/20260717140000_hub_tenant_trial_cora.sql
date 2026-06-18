    -- Período de teste por tenant + campos Cora em mensalidades (console Waje Owner).
    -- Idempotente.

    ALTER TABLE public.hub_tenants
      ADD COLUMN IF NOT EXISTS trial_ate TIMESTAMPTZ;

    COMMENT ON COLUMN public.hub_tenants.trial_ate IS
      'Fim do período de teste. Após esta data, sem mensalidade paga o tenant pode ser desativado automaticamente.';

    CREATE INDEX IF NOT EXISTS idx_hub_tenants_trial_ate
      ON public.hub_tenants (trial_ate)
      WHERE trial_ate IS NOT NULL AND ativo = true;

    ALTER TABLE public.hub_tenant_mensalidades
      ADD COLUMN IF NOT EXISTS cora_invoice_id TEXT,
      ADD COLUMN IF NOT EXISTS cora_boleto_url TEXT,
      ADD COLUMN IF NOT EXISTS cora_pix_emv TEXT,
      ADD COLUMN IF NOT EXISTS cora_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN public.hub_tenant_mensalidades.cora_invoice_id IS
      'ID da fatura/boleto na API Cora (Integração Direta).';
