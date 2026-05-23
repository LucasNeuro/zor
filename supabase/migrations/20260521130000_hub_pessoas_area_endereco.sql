-- Cadastro CRM: área de atuação e endereço (CEP / logradouro / bairro) em hub_pessoas.

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS bairro TEXT;

COMMENT ON COLUMN public.hub_pessoas.area_atuacao IS 'Mercado/setor do cliente (value de lib/crm/areas-atuacao.ts).';
COMMENT ON COLUMN public.hub_pessoas.cep IS 'CEP normalizado ou mascarado (8 dígitos).';
COMMENT ON COLUMN public.hub_pessoas.logradouro IS 'Logradouro (ViaCEP ou manual).';
COMMENT ON COLUMN public.hub_pessoas.bairro IS 'Bairro (ViaCEP ou manual).';
