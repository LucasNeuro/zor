-- =============================================================================
-- WAJE — Bootstrap Lucas = PLATAFORMA (após waje-reset-todos-dados.sql)
-- =============================================================================
-- Lucas NÃO se cadastra em /cadastro (página de CLIENTES).
-- Este script cria login + perfil ops (/crm/waje) sem tenant e sem CNPJ billing.
--
-- Depois: cadastre clientes em /cadastro com CNPJ DELES (ex. SHEFA 65.912.793/0001-60)
--         use outro e-mail para o owner do cliente (não lucasoffgod se Lucas = plataforma)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'platform_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'platform_admin';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  v_email text := 'lucasoffgod@hotmail.com';
  v_password text := '@sacola47';
  v_name text := 'Lucas Marcondes';
  v_user_id uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(v_email)) LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      trim(v_email), v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      NOW(), NOW(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', trim(v_email)),
      'email', v_user_id::text,
      NOW(), NOW(), NOW()
    );
  END IF;

  INSERT INTO public.users (
    auth_id, email, name, role, status,
    owner, tenant_id, access_role_id,
    document, document_type, billing_legal_name
  )
  VALUES (
    v_user_id, trim(v_email), v_name,
    'platform_admin'::public.app_role,
    'Ativo'::public.record_status,
    true, NULL, NULL,
    NULL, NULL, NULL
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = 'platform_admin'::public.app_role,
    status = 'Ativo'::public.record_status,
    owner = true,
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
    billing_uf = NULL,
    updated_at = NOW();

  RAISE NOTICE 'Lucas plataforma OK — login: % (sem tenant, sem CNPJ billing)', v_email;
END $$;

NOTIFY pgrst, 'reload schema';
