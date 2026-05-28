-- Correção rápida: coluna tenant_id em hub_negocios (e outras tabelas CRM).
-- Cole no SQL Editor do Supabase → Run → depois Reload schema (Settings → API).

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE public.hub_negocios
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);

-- Para relatórios + financeiro completo, use também: docs/sql/relatorios-schema-fix.sql
