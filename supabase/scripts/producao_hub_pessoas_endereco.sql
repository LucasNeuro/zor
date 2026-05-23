-- Produção: colunas de endereço/área em hub_pessoas (idempotente).
-- Rode no SQL Editor do Supabase se o cadastro CRM ainda falhar após o deploy.

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS bairro TEXT;

COMMENT ON COLUMN public.hub_pessoas.area_atuacao IS 'Mercado/setor do cliente.';
COMMENT ON COLUMN public.hub_pessoas.cep IS 'CEP (8 dígitos).';
COMMENT ON COLUMN public.hub_pessoas.logradouro IS 'Logradouro.';
COMMENT ON COLUMN public.hub_pessoas.bairro IS 'Bairro.';

-- Opcional multi-tenant (só se hub_tenants existir):
-- ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);
