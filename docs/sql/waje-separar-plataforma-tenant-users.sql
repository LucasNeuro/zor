-- Separar perfil PLATAFORMA (Onze/Lucas) do perfil CLIENTE (SHEFA)
-- Idempotente — rode no Supabase SQL Editor
--
-- Problema: provision-lucas-shefa-cadastro.sql criou lucasoffgod@hotmail.com
-- como owner do tenant SHEFA com billing_legal_name = SHEFA.
-- O mesmo login depois virou platform_admin — misturou tudo.
--
-- Modelo correto:
--   Lucas (plataforma Onze) → owner=true, platform_admin, tenant_id NULL, SEM billing de cliente
--   SHEFA (tenant)         → dados em hub_tenants.settings + user do CLIENTE (outro e-mail)

-- ── 0) Garantir valor platform_admin no enum app_role (se ainda não existir) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'platform_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'platform_admin';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 1) Lucas = só equipe plataforma Waje (Onze) ─────────────────────────────
UPDATE public.users
SET
  owner = true,
  role = 'platform_admin'::public.app_role,
  tenant_id = NULL,
  access_role_id = NULL,
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

-- ── 2) Tenant SHEFA — faturamento fica no cadastro do tenant (não no Lucas) ─
UPDATE public.hub_tenants
SET settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{registration_type}',
      '"PJ"'::jsonb
    ),
    '{cnpj}',
    '"65912793000160"'::jsonb
  ),
  '{empresa_cadastral}',
  COALESCE(settings->'empresa_cadastral', '{}'::jsonb) || jsonb_build_object(
    'cnpj', '65912793000160',
    'razao_social', 'SHEFA COMERCIO TECH LTDA',
    'atualizado_em', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
)
WHERE slug = 'shefa-comercio-tech';

-- ── 3) Outros users do tenant SHEFA (não Lucas) — billing do cliente ────────
UPDATE public.users u
SET
  document = '65912793000160',
  document_type = 'CNPJ',
  billing_legal_name = 'SHEFA COMERCIO TECH LTDA',
  owner = false
FROM public.hub_tenants t
WHERE u.tenant_id = t.id
  AND t.slug = 'shefa-comercio-tech'
  AND lower(trim(u.email)) <> 'lucasoffgod@hotmail.com';

-- ── 4) Conferência (rode e leia o resultado) ───────────────────────────────
SELECT
  u.email,
  u.role::text AS role,
  u.owner AS plataforma_ops,
  u.tenant_id,
  t.slug AS tenant_slug,
  u.document,
  u.billing_legal_name
FROM public.users u
LEFT JOIN public.hub_tenants t ON t.id = u.tenant_id
WHERE u.status = 'Ativo'::public.record_status
ORDER BY u.owner DESC, t.slug NULLS FIRST, u.email;

NOTIFY pgrst, 'reload schema';
