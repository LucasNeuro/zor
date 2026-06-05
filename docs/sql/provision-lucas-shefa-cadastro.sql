-- =============================================================================
-- TIVIA — provisionar cadastro SHEFA + usuário Lucas (sem e-mail / rate limit)
-- Rodar no Supabase Dashboard → SQL Editor (projeto vrlwfikzeyuywjgunyhy)
-- Idempotente: pode executar mais de uma vez.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.hub_tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_email text := 'lucasoffgod@hotmail.com';
  v_password text := '@sacola47';
  v_name text := 'Lucas';
  v_phone text := '11970364501';
  v_app_role text := 'owner';
  v_status text := 'Ativo';

  v_cnpj text := '65912793000160';
  v_company text := 'SHEFA COMERCIO TECH LTDA';
  v_trade text := 'SHEFA TECH';
  v_slug text := 'shefa-comercio-tech';

  v_user_id uuid;
  v_tenant_id uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
BEGIN
  -- ── 1) Supabase Auth + public.users ─────────────────────────────────────
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

    RAISE NOTICE 'Auth criado: %', v_user_id;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_user_id;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
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

    RAISE NOTICE 'Auth já existia (senha atualizada): %', v_user_id;
  END IF;

  INSERT INTO public.users (auth_id, email, name, role, status)
  VALUES (
    v_user_id, trim(v_email), v_name,
    v_app_role::public.app_role, v_status::public.record_status
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  RAISE NOTICE 'public.users OK — auth_id=%', v_user_id;

  -- ── 2) Tenant SHEFA (hub_tenants) ───────────────────────────────────────
  SELECT id INTO v_tenant_id
  FROM public.hub_tenants
  WHERE slug = v_slug
     OR (settings IS NOT NULL AND settings->>'cnpj' = v_cnpj)
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.hub_tenants (slug, nome_exibicao, ativo, settings)
    VALUES (
      v_slug,
      v_company,
      true,
      jsonb_build_object(
        'registration_type', 'PJ',
        'cnpj', v_cnpj,
        'cpf', null,
        'trade_name', v_trade,
        'address', jsonb_build_object(
          'cep', '05789001',
          'logradouro', 'CARLOS LACERDA',
          'numero', '3192',
          'complemento', 'APT 34',
          'bairro', 'PIRAJUSSARA',
          'cidade', 'SAO PAULO',
          'uf', 'SP'
        ),
        'primary_contact', jsonb_build_object(
          'name', v_name,
          'email', trim(v_email),
          'phone', v_phone
        ),
        'source', 'sql_provision_manual'
      )
    )
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE 'Tenant criado: id=% slug=%', v_tenant_id, v_slug;
  ELSE
    UPDATE public.hub_tenants
    SET
      nome_exibicao = v_company,
      ativo = true,
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'registration_type', 'PJ',
        'cnpj', v_cnpj,
        'trade_name', v_trade,
        'address', jsonb_build_object(
          'cep', '05789001',
          'logradouro', 'CARLOS LACERDA',
          'numero', '3192',
          'complemento', 'APT 34',
          'bairro', 'PIRAJUSSARA',
          'cidade', 'SAO PAULO',
          'uf', 'SP'
        ),
        'primary_contact', jsonb_build_object(
          'name', v_name,
          'email', trim(v_email),
          'phone', v_phone
        ),
        'source', 'sql_provision_manual'
      )
    WHERE id = v_tenant_id;

    RAISE NOTICE 'Tenant já existia (atualizado): id=%', v_tenant_id;
  END IF;

  RAISE NOTICE '── Próximo passo no .env.local ──';
  RAISE NOTICE 'DEFAULT_TENANT_ID=%', v_tenant_id;
  RAISE NOTICE 'NEXT_PUBLIC_TENANT_ID=%', v_tenant_id;
  RAISE NOTICE 'Login: % / senha definida no script', v_email;
END $$;

-- Verificação rápida
SELECT u.id, u.email, u.name, u.role, u.status, u.auth_id
FROM public.users u
WHERE lower(u.email) = 'lucasoffgod@hotmail.com';

SELECT t.id, t.slug, t.nome_exibicao, t.settings->>'cnpj' AS cnpj
FROM public.hub_tenants t
WHERE t.slug = 'shefa-comercio-tech' OR t.settings->>'cnpj' = '65912793000160';
