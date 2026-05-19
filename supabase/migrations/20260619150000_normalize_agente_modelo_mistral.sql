-- Normaliza modelos legados Anthropic → sentinel Mistral (Hub Mistral-first).
-- Corrige sync Mistral Agents API que rejeita IDs claude-*.

UPDATE public.hub_agente_identidade
SET
  modelo_padrao = 'mistral',
  modelo_critico = 'mistral',
  modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(modelo_padrao)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_padrao) ~* '^claude-'
  OR btrim(modelo_padrao) IN (
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-7'
  )
  OR NOT public.hub_agente_modelo_id_valido(modelo_padrao);

UPDATE public.hub_agente_identidade
SET modelo_critico = 'mistral'
WHERE
  lower(btrim(modelo_critico)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_critico) ~* '^claude-'
  OR NOT public.hub_agente_modelo_id_valido(modelo_critico);

UPDATE public.hub_agente_identidade
SET modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(modelo_alto_valor)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_alto_valor) ~* '^claude-'
  OR NOT public.hub_agente_modelo_id_valido(modelo_alto_valor);

-- Catálogo de cargos (novos agentes herdam daqui)
UPDATE public.hub_cargos_catalogo
SET
  modelo_padrao = 'mistral',
  modelo_critico = 'mistral',
  modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(COALESCE(modelo_padrao, ''))) IN ('haiku', 'sonnet', 'opus')
  OR btrim(COALESCE(modelo_padrao, '')) ~* '^claude-';

COMMENT ON COLUMN public.hub_agente_identidade.modelo_padrao IS
  'Sentinel mistral (MISTRAL_MODEL) ou ID Mistral explícito. Sync Mistral Agents usa sempre família Mistral.';
