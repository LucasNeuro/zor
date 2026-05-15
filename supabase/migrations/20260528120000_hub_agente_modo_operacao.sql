-- Modo de operação do agente: atendimento WhatsApp (webhook) vs jobs internos (ciclos/cron).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS modo_operacao text,
  ADD COLUMN IF NOT EXISTS ciclo_execucao_padrao text;

COMMENT ON COLUMN public.hub_agente_identidade.modo_operacao IS
  'canal_whatsapp = atendimento UAZAPI/webhook; jobs_internos = ciclos cron/dispatch.';
COMMENT ON COLUMN public.hub_agente_identidade.ciclo_execucao_padrao IS
  'interacao | tempo_real | agenda — escolha no wizard ao criar agente.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_agente_identidade_modo_operacao_check'
  ) THEN
    ALTER TABLE public.hub_agente_identidade
      ADD CONSTRAINT hub_agente_identidade_modo_operacao_check
      CHECK (modo_operacao IS NULL OR modo_operacao IN ('canal_whatsapp', 'jobs_internos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_agente_identidade_ciclo_execucao_padrao_check'
  ) THEN
    ALTER TABLE public.hub_agente_identidade
      ADD CONSTRAINT hub_agente_identidade_ciclo_execucao_padrao_check
      CHECK (
        ciclo_execucao_padrao IS NULL
        OR ciclo_execucao_padrao IN ('interacao', 'tempo_real', 'agenda')
      );
  END IF;
END $$;

-- Backfill a partir do ciclo padrão provisionado no wizard (se existir).
-- Nota: em UPDATE ... FROM o Postgres não deixa correlacionar a tabela alvo (h) dentro de um
-- subquery no FROM; por isso usamos uma subconsulta derivada por agente_slug.
UPDATE public.hub_agente_identidade h
SET
  ciclo_execucao_padrao = CASE c.tipo
    WHEN 'gatilho' THEN 'interacao'
    WHEN 'continuo' THEN 'tempo_real'
    WHEN 'programado' THEN 'agenda'
    ELSE NULL
  END,
  modo_operacao = CASE c.tipo
    WHEN 'gatilho' THEN 'canal_whatsapp'
    WHEN 'continuo' THEN 'jobs_internos'
    WHEN 'programado' THEN 'jobs_internos'
    ELSE NULL
  END
FROM (
  SELECT DISTINCT ON (c2.agente_slug)
    c2.agente_slug,
    c2.tipo
  FROM public.hub_ciclos_ia c2
  WHERE (c2.configuracoes->>'ciclo_origem_provisionamento') = 'wizard_agente_v1'
  ORDER BY c2.agente_slug, c2.id
) c
WHERE h.agente_slug = c.agente_slug
  AND h.modo_operacao IS NULL
  AND c.tipo IS NOT NULL;
