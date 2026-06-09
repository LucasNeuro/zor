-- Catálogo legado usa `nome`; a app CRM usa `titulo`. Alinha schema mínimo para wizard + IA.

ALTER TABLE public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS segmento TEXT,
  ADD COLUMN IF NOT EXISTS especialidade TEXT,
  ADD COLUMN IF NOT EXISTS descricao_curta TEXT,
  ADD COLUMN IF NOT EXISTS nivel INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS modelo_padrao TEXT DEFAULT 'mistral-small-latest',
  ADD COLUMN IF NOT EXISTS modelo_critico TEXT DEFAULT 'mistral-small-latest',
  ADD COLUMN IF NOT EXISTS modelo_alto_valor TEXT DEFAULT 'mistral-small-latest',
  ADD COLUMN IF NOT EXISTS supervisor_slug TEXT,
  ADD COLUMN IF NOT EXISTS pode_fazer_padrao TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS nao_pode_fazer_padrao TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS prompt_template TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS limite_autonomia_brl NUMERIC(12,2);

-- titulo ← nome (schema antigo)
UPDATE public.hub_cargos_catalogo
SET titulo = nome
WHERE (titulo IS NULL OR trim(titulo) = '')
  AND nome IS NOT NULL
  AND trim(nome) <> '';

-- nome ← titulo (linhas só com titulo)
UPDATE public.hub_cargos_catalogo
SET nome = titulo
WHERE (nome IS NULL OR trim(nome) = '')
  AND titulo IS NOT NULL
  AND trim(titulo) <> '';
