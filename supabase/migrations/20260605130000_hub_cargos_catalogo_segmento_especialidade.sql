-- Segmentação do catálogo de cargos (filtros e ordenação no CRM).
ALTER TABLE public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS segmento TEXT,
  ADD COLUMN IF NOT EXISTS especialidade TEXT;

-- Backfill: derivar segmento legível a partir de area quando vazio.
UPDATE public.hub_cargos_catalogo
SET segmento = CASE lower(trim(coalesce(area, '')))
  WHEN 'comercial' THEN 'Comercial'
  WHEN 'marketing' THEN 'Marketing'
  WHEN 'operacoes' THEN 'Operações'
  WHEN 'operac' THEN 'Operações'
  WHEN 'suporte' THEN 'Suporte'
  WHEN 'financeiro' THEN 'Financeiro'
  WHEN 'geral' THEN NULL
  WHEN '' THEN NULL
  ELSE initcap(trim(area))
END
WHERE segmento IS NULL OR trim(segmento) = '';
