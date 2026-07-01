-- Aplicar manualmente se a migração 20260804100000 ainda não correu no projeto Supabase.
ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS interesse_principal TEXT;

COMMENT ON COLUMN public.hub_leads_crm.interesse_principal IS
  'Interesse ou intenção principal do lead (vendas, suporte, demo, etc.). Usado por agentes IA e CRM.';
