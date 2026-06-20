-- Reset de faturamento / tenant para recadastrar cliente (ex.: SHEFA)
-- Rode no Supabase SQL Editor. Ajuste os filtros no bloco "vars" abaixo.
--
-- NÃO use /cadastro com CNPJ da ONNZE (62.449.971/0001-70) — a plataforma bloqueia de propósito.
-- ONNZE = emissor Cora (env Render). Cliente = pagador (CNPJ no cadastro, ex. SHEFA 65.912.793/0001-60).
--
-- Lucas (equipe plataforma): use waje-separar-plataforma-tenant-users.sql + waje-ops-promote-platform-user.sql
-- Não apague owner=true / platform_admin se quiser manter acesso /crm/waje.

-- ── 0) Conferir antes de apagar ─────────────────────────────────────────────
SELECT
  t.id,
  t.slug,
  t.nome_exibicao,
  t.ativo,
  t.trial_ate,
  regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g') AS settings_cnpj,
  regexp_replace(coalesce(t.settings->'empresa_cadastral'->>'cnpj', ''), '\D', '', 'g') AS cadastral_cnpj,
  (SELECT count(*) FROM public.hub_tenant_mensalidades m WHERE m.tenant_id = t.id) AS mensalidades,
  (SELECT count(*) FROM public.users u WHERE u.tenant_id = t.id) AS users_tenant
FROM public.hub_tenants t
WHERE t.slug ILIKE '%shefa%'
   OR t.nome_exibicao ILIKE '%shefa%'
   OR regexp_replace(coalesce(t.settings->>'cnpj', ''), '\D', '', 'g') IN ('65912793000160', '62449971000170');

SELECT
  u.email,
  u.role::text,
  u.owner AS plataforma_ops,
  u.tenant_id,
  regexp_replace(coalesce(u.document, ''), '\D', '', 'g') AS user_document,
  u.billing_legal_name
FROM public.users u
WHERE u.status = 'Ativo'::public.record_status
  AND (
    u.tenant_id IN (SELECT id FROM public.hub_tenants WHERE slug ILIKE '%shefa%')
    OR regexp_replace(coalesce(u.document, ''), '\D', '', 'g') IN ('65912793000160', '62449971000170')
    OR lower(trim(u.email)) = 'lucasoffgod@hotmail.com'
  )
ORDER BY u.email;

-- ── 1) Apagar tenant SHEFA (e filhos ON DELETE CASCADE) ───────────────────
-- Descomente após conferir o SELECT acima.

/*
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.hub_tenants
  WHERE slug = 'shefa-comercio-tech'
     OR nome_exibicao ILIKE '%SHEFA%'
  ORDER BY criado_em NULLS LAST
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Nenhum tenant SHEFA encontrado.';
    RETURN;
  END IF;

  -- Mensalidades / boletos Cora (hub_ops_cobranca_envios cascade via mensalidade)
  DELETE FROM public.hub_tenant_mensalidades WHERE tenant_id = v_tenant_id;

  -- Users do tenant (não mexe em lucas se tenant_id NULL após separar-plataforma)
  DELETE FROM public.users
  WHERE tenant_id = v_tenant_id
    AND lower(trim(email)) <> 'lucasoffgod@hotmail.com';

  -- Tenant (muitas tabelas hub_* têm ON DELETE CASCADE)
  DELETE FROM public.hub_tenants WHERE id = v_tenant_id;

  RAISE NOTICE 'Tenant SHEFA removido: %', v_tenant_id;
END $$;
*/

-- ── 2) Limpar Lucas como "cliente" (manter como plataforma) ───────────────
-- Rode waje-separar-plataforma-tenant-users.sql se ainda não rodou.

/*
UPDATE public.users
SET
  owner = true,
  role = 'platform_admin'::public.app_role,
  tenant_id = NULL,
  document = NULL,
  document_type = NULL,
  billing_legal_name = NULL,
  billing_cep = NULL,
  billing_logradouro = NULL,
  billing_numero = NULL,
  billing_complemento = NULL,
  billing_bairro = NULL,
  billing_cidade = NULL,
  billing_uf = NULL
WHERE lower(trim(email)) = 'lucasoffgod@hotmail.com';
*/

-- ── 3) Auth: só se for recriar login do zero ─────────────────────────────
-- Cuidado: apaga login Supabase. Faça pelo Dashboard → Authentication se preferir.

/*
DELETE FROM auth.users WHERE lower(email) = 'lucasoffgod@hotmail.com';
*/

NOTIFY pgrst, 'reload schema';
