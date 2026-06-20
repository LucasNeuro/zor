-- Verificar por que boleto Cora não emite (pagador vs emissor Onze)
-- Rode no Supabase SQL Editor e leia o resultado

-- CNPJ emissor Cora (Onze) — NÃO pode ser pagador
-- 62449971000170 = 62.449.971/0001-70
-- Pagador SHEFA correto: 65912793000160

SELECT
  t.id AS tenant_id,
  t.slug,
  t.nome_exibicao,
  regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g') AS settings_cnpj,
  regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cnpj', ''), '\D', '', 'g') AS cadastral_cnpj,
  u.email,
  u.owner AS plataforma_ops,
  regexp_replace(coalesce(u.document, ''), '\D', '', 'g') AS user_document,
  u.billing_legal_name,
  CASE
    WHEN regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g') = '62449971000170'
      OR regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cnpj', ''), '\D', '', 'g') = '62449971000170'
      OR regexp_replace(coalesce(u.document, ''), '\D', '', 'g') = '62449971000170'
    THEN 'ERRO: CNPJ da Onze (emissor) gravado como pagador — corrija abaixo'
    WHEN regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g') = '65912793000160'
      OR regexp_replace(coalesce(u.document, ''), '\D', '', 'g') = '65912793000160'
    THEN 'OK: pagador parece SHEFA — se boleto falhar, credenciais Cora no Render'
    ELSE 'REVISAR: CNPJ pagador incompleto ou ausente'
  END AS diagnostico
FROM public.hub_tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id AND u.status = 'Ativo'::public.record_status
WHERE t.slug ILIKE '%shefa%' OR t.nome_exibicao ILIKE '%shefa%'
ORDER BY u.email NULLS LAST;

-- Correção forçada SHEFA (rode se diagnostico = ERRO)
/*
UPDATE public.hub_tenants
SET settings = jsonb_set(
  jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{cnpj}',
    '"65912793000160"'::jsonb
  ),
  '{empresa_cadastral}',
  COALESCE(settings->'empresa_cadastral', '{}'::jsonb) || '{"cnpj":"65912793000160","razao_social":"SHEFA COMERCIO TECH LTDA"}'::jsonb
)
WHERE slug ILIKE '%shefa%' OR nome_exibicao ILIKE '%SHEFA%';

UPDATE public.users u
SET
  document = '65912793000160',
  document_type = 'CNPJ',
  billing_legal_name = 'SHEFA COMERCIO TECH LTDA',
  owner = false
FROM public.hub_tenants t
WHERE u.tenant_id = t.id
  AND (t.slug ILIKE '%shefa%' OR t.nome_exibicao ILIKE '%SHEFA%')
  AND lower(trim(u.email)) <> 'lucasoffgod@hotmail.com'
  AND regexp_replace(coalesce(u.document, ''), '\D', '', 'g') = '62449971000170';
*/
