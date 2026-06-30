-- Normaliza leads com estágio órfão (slug que não existe no pipeline do lead).
-- Ex.: estagio = qualificando mas colunas do pipeline usam qualificado.

UPDATE public.hub_leads_crm l
SET
  estagio_funil = CASE
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN ('qualificando', 'aguardando_resposta')
      THEN 'qualificado'
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN ('convertido_negocio', 'ganho')
      THEN COALESCE(
        (SELECT e.slug FROM public.hub_pipeline_estagios e
         JOIN public.hub_pipelines p ON p.id = e.pipeline_id
         WHERE e.tipo_fecho = 'ganho' AND (l.pipeline_id IS NULL OR e.pipeline_id = l.pipeline_id)
         LIMIT 1),
        'ganho'
      )
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN ('negociando', 'proposta', 'fechamento', 'encaminhado')
      THEN 'em_atendimento'
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IS NULL
      THEN 'novo'
    ELSE COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), ''), 'novo')
  END,
  estagio = CASE
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN ('qualificando', 'aguardando_resposta')
      THEN 'qualificado'
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN ('negociando', 'proposta', 'fechamento', 'encaminhado')
      THEN 'em_atendimento'
    WHEN COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IS NULL
      THEN 'novo'
    ELSE COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), ''), 'novo')
  END,
  atualizado_em = NOW()
WHERE
  COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IS NULL
  OR COALESCE(NULLIF(TRIM(l.estagio_funil), ''), NULLIF(TRIM(l.estagio), '')) IN (
    'qualificando', 'aguardando_resposta', 'negociando', 'proposta', 'fechamento', 'encaminhado', 'convertido_negocio'
  );
