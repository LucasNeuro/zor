-- =============================================================================
-- WAJE — ZERAR TODOS OS DADOS (começar do zero com clientes reais)
-- =============================================================================
-- IRREVERSÍVEL. Apaga tenants, CRM, financeiro, mensalidades, users app e logins Auth.
-- NÃO apaga: schema, migrations, enums, functions, buckets (só os arquivos dentro).
--
-- Onde rodar: Supabase Dashboard → SQL Editor → cole → Run
-- Depois: Settings → API → Reload schema
--
-- Próximo passo após zerar:
--   1) Criar login Lucas (Auth) ou usar /cadastro só para CLIENTES (CNPJ do cliente, não Onze)
--   2) Rodar waje-ops-promote-platform-user.sql para Lucas = plataforma (/crm/waje)
--   3) Cadastrar clientes reais em /cadastro (ex. SHEFA 65.912.793/0001-60)
--   4) Render: credenciais Cora ONNZE alinhadas (client_id + cert + key do mesmo zip)
-- =============================================================================

-- ── 0) Conferência (rode primeiro) ───────────────────────────────────────────
SELECT 'hub_tenants' AS t, count(*) AS n FROM public.hub_tenants
UNION ALL SELECT 'public.users', count(*) FROM public.users
UNION ALL SELECT 'hub_leads_crm', count(*) FROM public.hub_leads_crm
UNION ALL SELECT 'hub_negocios', count(*) FROM public.hub_negocios
UNION ALL SELECT 'hub_tenant_mensalidades', count(*) FROM public.hub_tenant_mensalidades
UNION ALL SELECT 'auth.users', count(*) FROM auth.users;

-- ── 1) APAGAR TODAS AS TABELAS public.* (dados) ─────────────────────────────
-- Descomente o bloco abaixo para executar.

/*
DO $$
DECLARE
  stmt text;
BEGIN
  SELECT
    'TRUNCATE TABLE '
    || string_agg(format('public.%I', tablename), ', ' ORDER BY tablename)
    || ' RESTART IDENTITY CASCADE'
  INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public';

  IF stmt IS NULL THEN
    RAISE EXCEPTION 'Nenhuma tabela public encontrada.';
  END IF;

  RAISE NOTICE 'Executando: %', left(stmt, 200) || '...';
  EXECUTE stmt;
END $$;
*/

-- ── 2) APAGAR logins Supabase Auth ───────────────────────────────────────────
-- Descomente junto com o bloco 1.

/*
TRUNCATE auth.users CASCADE;
*/

-- ── 3) APAGAR arquivos nos buckets (PDFs, conhecimento, etc.) ──────────────
-- Descomente se quiser storage vazio também.

/*
DELETE FROM storage.objects
WHERE bucket_id IN (
  'waje-ops-boletos',
  'hub-tenant-conhecimento'
);
*/

-- ── 4) Recarregar API ────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 5) Conferência pós-reset (deve tudo = 0) ───────────────────────────────
-- SELECT 'hub_tenants' AS t, count(*) AS n FROM public.hub_tenants
-- UNION ALL SELECT 'public.users', count(*) FROM public.users
-- UNION ALL SELECT 'auth.users', count(*) FROM auth.users;
