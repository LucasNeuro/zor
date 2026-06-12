-- Repara hub_msg_jobs quando a tabela existe sem colunas da migração 20260619130000
-- (CREATE TABLE IF NOT EXISTS não adiciona colunas novas a tabelas antigas).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.hub_msg_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS canal TEXT;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS lead_id UUID NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS agente_slug TEXT NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS locked_by TEXT NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS last_error TEXT NULL;
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.hub_msg_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill mínimo para linhas legadas
UPDATE public.hub_msg_jobs
SET
  canal = COALESCE(NULLIF(trim(canal), ''), 'whatsapp'),
  telefone = COALESCE(NULLIF(trim(telefone), ''), 'unknown'),
  message_id = COALESCE(NULLIF(trim(message_id), ''), id::text)
WHERE canal IS NULL OR telefone IS NULL OR message_id IS NULL;

ALTER TABLE public.hub_msg_jobs ALTER COLUMN canal SET NOT NULL;
ALTER TABLE public.hub_msg_jobs ALTER COLUMN telefone SET NOT NULL;
ALTER TABLE public.hub_msg_jobs ALTER COLUMN message_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_msg_jobs_status_chk'
  ) THEN
    ALTER TABLE public.hub_msg_jobs
      ADD CONSTRAINT hub_msg_jobs_status_chk
      CHECK (status IN ('pending', 'processing', 'done', 'retry', 'dead'));
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hub_msg_jobs_status_chk: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_msg_jobs_canal_message_id_key'
  ) THEN
    ALTER TABLE public.hub_msg_jobs
      ADD CONSTRAINT hub_msg_jobs_canal_message_id_key UNIQUE (canal, message_id);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hub_msg_jobs_canal_message_id_key: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS hub_msg_jobs_pending_available_idx
  ON public.hub_msg_jobs (available_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS hub_msg_jobs_telefone_created_at_idx
  ON public.hub_msg_jobs (telefone, created_at DESC);

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_msg_jobs_set_updated_at ON public.hub_msg_jobs;
CREATE TRIGGER trg_hub_msg_jobs_set_updated_at
BEFORE UPDATE ON public.hub_msg_jobs
FOR EACH ROW
EXECUTE FUNCTION public.hub_msg_jobs_set_updated_at();

COMMENT ON TABLE public.hub_msg_jobs IS
  'Fila assíncrona WhatsApp/e-mail. Dedupe por (canal, message_id).';

-- RPCs exigidas pelo worker (podem faltar se só a tabela foi criada manualmente)
CREATE OR REPLACE FUNCTION public.hub_msg_jobs_claim_batch(
  p_worker_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS SETOF public.hub_msg_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 1;
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT j.id
    FROM public.hub_msg_jobs j
    WHERE
      j.status IN ('pending', 'retry')
      AND j.available_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.hub_msg_jobs p
        WHERE
          p.telefone = j.telefone
          AND p.status = 'processing'
          AND p.id <> j.id
      )
    ORDER BY j.available_at ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  atualizados AS (
    UPDATE public.hub_msg_jobs j
    SET
      status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now(),
      locked_by = NULLIF(trim(p_worker_id), ''),
      last_error = NULL,
      updated_at = now()
    WHERE j.id IN (SELECT c.id FROM candidatos c)
    RETURNING j.*
  )
  SELECT * FROM atualizados;
END;
$$;

COMMENT ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) IS
  'Claim atômico em lote com SKIP LOCKED para hub_msg_jobs (pending/retry -> processing), preservando exclusão por telefone.';

REVOKE ALL ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_try_lock_conversation(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT pg_try_advisory_lock(hashtextextended(COALESCE(p_telefone, ''), 0));
$$;

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_unlock_conversation(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT pg_advisory_unlock(hashtextextended(COALESCE(p_telefone, ''), 0));
$$;

REVOKE ALL ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) TO service_role;
