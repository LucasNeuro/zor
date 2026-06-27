-- Identificador único de conversa WhatsApp: um lead por (tenant_id, telefone).
-- Se falhar por duplicatas existentes, execute antes:
--   supabase/scripts/dedupe_leads_telefone.sql

CREATE UNIQUE INDEX IF NOT EXISTS hub_leads_crm_tenant_telefone_unique
  ON public.hub_leads_crm (tenant_id, telefone)
  WHERE telefone IS NOT NULL AND length(trim(telefone)) >= 10;

COMMENT ON INDEX public.hub_leads_crm_tenant_telefone_unique IS
  'Um lead CRM por número WhatsApp (tenant). Evita cards duplicados no funil.';
