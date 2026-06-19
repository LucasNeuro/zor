-- Corrige CNPJ do pagador quando users.document ficou com o CNPJ da emissora Cora (Onze)
-- Emissor (conta credenciais): 62.449.971/0001-70 — NÃO usar como pagador
-- Ajuste slug/CNPJ do cliente abaixo antes de executar

UPDATE public.users u
SET
  document = '65912793000160',
  document_type = 'CNPJ',
  billing_legal_name = COALESCE(nullif(trim(u.billing_legal_name), ''), 'SHEFA COMERCIO TECH LTDA')
FROM public.hub_tenants t
WHERE u.tenant_id = t.id
  AND t.slug = 'shefa-comercio-tech'
  AND regexp_replace(coalesce(u.document, ''), '\D', '', 'g') = '62449971000170';

UPDATE public.hub_tenants
SET settings = jsonb_set(
  jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{cnpj}',
    '"65912793000160"'::jsonb
  ),
  '{empresa_cadastral}',
  COALESCE(settings->'empresa_cadastral', '{}'::jsonb) || '{"cnpj":"65912793000160"}'::jsonb
)
WHERE slug = 'shefa-comercio-tech';

NOTIFY pgrst, 'reload schema';
