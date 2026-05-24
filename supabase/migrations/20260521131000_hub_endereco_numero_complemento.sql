-- Número e complemento no endereço (cadastro PF/PJ e empresas).

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS complemento TEXT;

ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS complemento TEXT;

COMMENT ON COLUMN public.hub_pessoas.numero IS 'Número do imóvel (endereço).';
COMMENT ON COLUMN public.hub_pessoas.complemento IS 'Complemento (sala, bloco, etc.).';
COMMENT ON COLUMN public.hub_empresas.numero IS 'Número do imóvel (endereço).';
COMMENT ON COLUMN public.hub_empresas.complemento IS 'Complemento (sala, bloco, etc.).';
