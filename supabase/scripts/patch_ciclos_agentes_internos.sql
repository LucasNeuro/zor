-- Repara ciclos programados de agentes internos (Cadência na agenda) para dispatch api=agente.
-- Execute no Supabase SQL Editor se Fabricio/Marcus etc. tiverem ciclos sem dispatch.

UPDATE public.hub_ciclos_ia c
SET configuracoes = COALESCE(c.configuracoes, '{}'::jsonb) || jsonb_build_object(
  'dispatch', jsonb_build_object('api', 'agente', 'ciclo', 'briefing_programado'),
  'brief_padrao',
  'Rotina programada: consulte dados operacionais da empresa (hub_dados_empresa) e produza resumo útil conforme cargo e playbook.',
  'dispatch_pendente', false
)
FROM public.hub_agente_identidade a
WHERE c.agente_slug = a.agente_slug
  AND a.modo_operacao = 'jobs_internos'
  AND c.tipo = 'programado'
  AND (
    c.nome ILIKE '%cadência%' OR c.nome ILIKE '%cadencia%' OR c.nome ILIKE '%agenda%'
  )
  AND (c.configuracoes->'dispatch' IS NULL OR c.configuracoes->'dispatch' = 'null'::jsonb);
