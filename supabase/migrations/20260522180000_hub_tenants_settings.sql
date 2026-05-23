-- Configurações por tenant (horário comercial, etc.)
ALTER TABLE public.hub_tenants
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
