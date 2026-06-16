-- Patch rápido se waje-hub-negocios.sql falhou na linha do prefixo_mercado
-- (tabela legada sem essa coluna). Cole e rode → depois Reload schema API.

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS prefixo_mercado TEXT DEFAULT 'GRL';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'novo';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;

ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_etapa_chk;
ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_status_chk;

UPDATE public.hub_negocios SET titulo = 'Negócio' WHERE titulo IS NULL OR btrim(titulo) = '';
UPDATE public.hub_negocios SET prefixo_mercado = 'GRL' WHERE prefixo_mercado IS NULL OR btrim(prefixo_mercado) = '';
UPDATE public.hub_negocios SET etapa = 'novo' WHERE etapa IS NULL OR btrim(etapa) = '';
UPDATE public.hub_negocios SET status = 'aberto' WHERE status IS NULL OR btrim(status) = '';

NOTIFY pgrst, 'reload schema';
