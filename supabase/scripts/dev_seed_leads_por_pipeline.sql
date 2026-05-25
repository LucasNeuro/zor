-- DEV ONLY
-- Cria 12 leads de teste por pipeline de leads para validar tabs, kanban e cards.
-- Seguro para reexecutar: apaga apenas códigos "LED-DEV-%" antes de recriar.

BEGIN;

DELETE FROM public.hub_leads_crm
WHERE codigo LIKE 'LED-DEV-%';

WITH base_pipelines AS (
  SELECT
    p.id,
    p.slug,
    p.nome,
    COALESCE(p.mercado_sigla, 'IMB') AS mercado_sigla,
    ROW_NUMBER() OVER (ORDER BY p.ordem, p.nome, p.id) AS pipeline_ordem
  FROM public.hub_pipelines p
  WHERE p.tipo = 'lead'
    AND p.ativo = true
),
serie AS (
  SELECT generate_series(1, 12) AS n
),
payload AS (
  SELECT
    p.id AS pipeline_id,
    p.slug,
    p.nome,
    p.mercado_sigla,
    p.pipeline_ordem,
    s.n,
    CASE ((s.n - 1) % 8)
      WHEN 0 THEN 'novo'
      WHEN 1 THEN 'qualificando'
      WHEN 2 THEN 'qualificado'
      WHEN 3 THEN 'proposta'
      WHEN 4 THEN 'negociando'
      WHEN 5 THEN 'fechamento'
      WHEN 6 THEN 'ganho'
      ELSE 'perdido'
    END AS estagio,
    CASE ((s.n - 1) % 8)
      WHEN 0 THEN 'whatsapp'
      WHEN 1 THEN 'instagram'
      WHEN 2 THEN 'meta_ads'
      WHEN 3 THEN 'google_ads'
      WHEN 4 THEN 'site'
      WHEN 5 THEN 'indicacao'
      WHEN 6 THEN 'linkedin'
      ELSE 'outro'
    END AS origem,
    CASE p.mercado_sigla
      WHEN 'IMB' THEN 'Imobiliário'
      WHEN 'ARQ' THEN 'Arquitetura'
      WHEN 'RFM' THEN 'Reforma'
      WHEN 'MRC' THEN 'Marcenaria'
      WHEN 'ENG' THEN 'Engenharia'
      WHEN 'SRV' THEN 'Serviços'
      WHEN 'PRO' THEN 'Produtos'
      WHEN 'FOR' THEN 'Fornecedor'
      ELSE 'Global'
    END AS mercado_nome
  FROM base_pipelines p
  CROSS JOIN serie s
)
INSERT INTO public.hub_leads_crm (
  codigo,
  nome,
  telefone,
  email,
  origem,
  campanha,
  estagio,
  score,
  valor_estimado,
  agente_responsavel,
  humano_responsavel,
  proxima_acao,
  tags,
  metadata,
  tenant_id,
  pipeline_id,
  ultimo_contato,
  criado_em,
  atualizado_em
)
SELECT
  'LED-DEV-' || UPPER(REPLACE(slug, '-', '')) || '-' || LPAD(n::text, 2, '0') AS codigo,
  mercado_nome || ' Lead ' || LPAD(n::text, 2, '0') AS nome,
  '55119' || LPAD((pipeline_ordem * 100000 + n * 137)::text, 8, '0') AS telefone,
  'lead+' || LOWER(REPLACE(slug, '-', '_')) || '_' || n::text || '@dev.obra10.local' AS email,
  origem,
  'Campanha DEV · ' || mercado_nome AS campanha,
  estagio,
  LEAST(96, 34 + (n * 5)) AS score,
  ((pipeline_ordem * 12) + n) * 1750 AS valor_estimado,
  CASE (n % 4)
    WHEN 0 THEN 'mari'
    WHEN 1 THEN 'sdr'
    WHEN 2 THEN 'lucas'
    ELSE 'obra10'
  END AS agente_responsavel,
  'admin',
  CASE ((n - 1) % 4)
    WHEN 0 THEN 'Retomar contacto e validar interesse.'
    WHEN 1 THEN 'Agendar apresentação comercial.'
    WHEN 2 THEN 'Enviar proposta e confirmar recebimento.'
    ELSE 'Revisar dados do lead no sideover.'
  END AS proxima_acao,
  ARRAY['dev_seed', LOWER(mercado_sigla), LOWER(estagio)],
  jsonb_build_object(
    'origem_cadastro', 'dev_seed_pipeline',
    'mercados', jsonb_build_array(mercado_sigla),
    'mercado_principal', mercado_sigla,
    'pipeline_seed', slug
  ),
  '00000000-0000-4000-8000-000000000001'::uuid,
  pipeline_id,
  NOW() - ((n % 6) * INTERVAL '17 minutes'),
  NOW() - ((12 - n) * INTERVAL '3 hours'),
  NOW() - ((n % 7) * INTERVAL '11 minutes')
FROM payload
ORDER BY slug, n;

COMMIT;

-- Como usar:
-- 1) Executa depois das migrações de pipelines.
-- 2) Recarrega /crm/leads.
-- 3) Para limpar, roda:
--    DELETE FROM public.hub_leads_crm WHERE codigo LIKE 'LED-DEV-%';
