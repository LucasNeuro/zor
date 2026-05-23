-- Utilizadores da aplicação (login CRM): Auth + public.users (role, status).
-- Idempotente: seguro em bases que já têm enums/tabela parciais.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM (
      'owner',
      'admin',
      'vendedor',
      'atendente',
      'parceiro'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.record_status AS ENUM ('Ativo', 'Inativo', 'Arquivado');
  END IF;
END $$;

-- Valores extra em app_role (migração 20260511120000 pode já ter corrido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'owner'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'vendedor',
  status public.record_status NOT NULL DEFAULT 'Ativo',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (lower(trim(email)));

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_service_role_all ON public.users;
CREATE POLICY users_service_role_all ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.users IS 'Perfil app: papéis CRM (app_role) ligados a auth.users via auth_id.';
