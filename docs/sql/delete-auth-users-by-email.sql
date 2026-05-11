-- Remove utilizadores do Auth (e filhos) quando o Dashboard falha:
-- "Failed to delete user: Database error loading user".
--
-- 1) Edita a linha `emails` abaixo: em PostgreSQL cada e-mail tem de estar separado por VÍRGULA.
--    Certo:  ARRAY['a@x.com', 'b@y.com']
--    Errado: primeira linha sem vírgula no fim antes da segunda (erro perto de `]`).
-- 2) Correr no Supabase → SQL Editor.
-- 3) Recria com docs/sql/provision-auth-user-and-public-users.sql (tokens '' obrigatórios).
--
-- Ordem: refresh_tokens → sessions → identities → MFA (se existir) → public.users → auth.users

DO $$
DECLARE
  -- Um ou mais e-mails (vírgula entre cada um):
  emails text[] := ARRAY['developadm@teste.com'::text];
  -- Exemplo com dois: ARRAY['developadm@teste.com'::text, 'admin@exemplo.com'::text];
  norm text[] := (SELECT array_agg(lower(btrim(n))) FROM unnest(emails) AS u(n));
BEGIN
  BEGIN
    DELETE FROM auth.mfa_challenges mc
    USING auth.mfa_factors mf, auth.users u
    WHERE mc.factor_id = mf.id AND mf.user_id = u.id AND lower(trim(u.email)) = ANY (norm);
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM auth.mfa_factors mf
    USING auth.users u
    WHERE mf.user_id = u.id AND lower(trim(u.email)) = ANY (norm);
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  DELETE FROM auth.refresh_tokens rt
  USING auth.users u
  WHERE rt.user_id = u.id AND lower(trim(u.email)) = ANY (norm);

  DELETE FROM auth.sessions s
  USING auth.users u
  WHERE s.user_id = u.id AND lower(trim(u.email)) = ANY (norm);

  DELETE FROM auth.identities i
  USING auth.users u
  WHERE i.user_id = u.id AND lower(trim(u.email)) = ANY (norm);

  DELETE FROM public.users pu
  USING auth.users u
  WHERE pu.auth_id = u.id AND lower(trim(u.email)) = ANY (norm);

  DELETE FROM auth.users u
  WHERE lower(trim(u.email)) = ANY (norm);

  RAISE NOTICE 'Auth removido para: %', emails;
END $$;
