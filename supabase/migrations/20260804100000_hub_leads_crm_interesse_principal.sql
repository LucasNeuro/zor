-- Coluna interesse_principal em hub_leads_crm (usada por hub_int_crm_ent_lead, WhatsApp, CRM UI).
-- O código TypeScript já referencia este campo; sem a coluna, tools do harness falham em modo operar.

ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS interesse_principal TEXT;

COMMENT ON COLUMN public.hub_leads_crm.interesse_principal IS
  'Interesse ou intenção principal do lead (vendas, suporte, demo, etc.). Usado por agentes IA e CRM.';
