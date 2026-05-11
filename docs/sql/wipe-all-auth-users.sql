-- Apaga TODOS os utilizadores do Supabase Auth (auth.users) e sessões/tokens associados.
-- Use quando quiser “zerar” o Auth e recriar utilizadores (ex.: provision-auth-user-and-public-users.sql).
--
-- ONDE CORRER: Supabase Dashboard → SQL Editor (projeto certo).
-- BACKUP: Se não tens a certeza, exporta ou duplica o projeto antes.
--
-- IMPORTANTE
-- - Se outras tabelas tiverem FK para `public.users`, o `DELETE FROM public.users` pode falhar.
--   Nesse caso comenta esse passo no bloco abaixo e limpa primeiro as dependências.
-- - Não apagues `auth.instances` nem outras tabelas de sistema do Auth.

DO $$
BEGIN
  -- Tabelas opcionais (versões diferentes do GoTrue / MFA / OAuth)
  BEGIN DELETE FROM auth.mfa_challenges; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.mfa_amr_claims; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.mfa_factors; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.one_time_tokens; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.oauth_authorizations; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.oauth_consents; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.saml_relay_states; EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.refresh_tokens;
  DELETE FROM auth.sessions;
  DELETE FROM auth.identities;

  -- Perfis da app ligados ao Auth (comenta se não quiseres apagar public.users)
  BEGIN
    DELETE FROM public.users;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  DELETE FROM auth.users;
END $$;

-- Após correr: recria utilizadores no Dashboard ou com provision-auth-user-and-public-users.sql
