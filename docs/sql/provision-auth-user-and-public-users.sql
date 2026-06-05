-- Modelo: criar utilizador Supabase Auth + linha em public.users (auth_id, email, role, status).
-- Correr no Supabase Dashboard → SQL Editor. Idempotente: pode voltar a correr se a 1.ª execução
-- criou Auth mas falhou depois, ou se public.users já tinha o auth_id.
-- Insere em auth.users com tokens '' (obrigatório p/ GoTrue; ver fix-auth-users-null-token-columns.sql se já criaste users com NULL).
--
-- Pré-requisitos: enums app_role / record_status; opcional migr. app_role owner+admin.
--
-- .env típico: LOGIN_ENFORCE_APP_USERS=true, opcional LOGIN_ALLOWED_APP_ROLES

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  -- ↓ Personaliza antes de correr (não commites senhas no git)
  v_email text := 'lucasoffgod@hotmail.com';
  v_password text := '@sacola47';
  v_name text := 'Lucas';
  v_app_role text := 'owner';
  v_status text := 'Ativo';

  v_user_id uuid;
  v_encrypted_pw text := crypt(v_password, gen_salt('bf'));
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(v_email)) LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      trim(v_email),
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', trim(v_email)),
      'email',
      v_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Auth criado: id=% email=%', v_user_id, v_email;
  ELSE
    -- Auth já existe: actualiza senha + garante identity + alinha public.users.
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_user_id;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', trim(v_email)),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
      );
    END IF;

    RAISE NOTICE 'Auth já existia; public.users será alinhado abaixo. id=% email=%', v_user_id, v_email;
  END IF;

  INSERT INTO public.users (auth_id, email, name, role, status)
  VALUES (
    v_user_id,
    trim(v_email),
    v_name,
    v_app_role::public.app_role,
    v_status::public.record_status
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  RAISE NOTICE 'public.users OK: auth_id=%', v_user_id;
END $$;
