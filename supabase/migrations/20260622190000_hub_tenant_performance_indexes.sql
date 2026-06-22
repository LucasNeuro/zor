-- Phase A: composite indexes for multi-tenant hot paths + tenant_id on hub_aprovacoes.

-- hub_aprovacoes: tenant scoping (backfill from lead when possible)
ALTER TABLE public.hub_aprovacoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_aprovacoes a
SET tenant_id = l.tenant_id
FROM public.hub_leads_crm l
WHERE a.tenant_id IS NULL
  AND a.lead_id IS NOT NULL
  AND a.lead_id = l.id
  AND l.tenant_id IS NOT NULL;

UPDATE public.hub_aprovacoes
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_tenant_status
  ON public.hub_aprovacoes (tenant_id, status, criado_em DESC);

-- hub_msg_jobs: worker claim by tenant (column exists since 20260619130000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_msg_jobs'
      AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_hub_msg_jobs_tenant_status_available
      ON public.hub_msg_jobs (tenant_id, status, available_at)
      WHERE status IN ('pending', 'retry');
  END IF;
END $$;

-- hub_fila_mensagens: dashboard + atendimento counts
CREATE INDEX IF NOT EXISTS idx_hub_fila_mensagens_tenant_status_dir
  ON public.hub_fila_mensagens (tenant_id, status, direcao);

-- hub_leads_crm: dashboard "leads hoje" and recent lists
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_tenant_criado
  ON public.hub_leads_crm (tenant_id, criado_em DESC);
