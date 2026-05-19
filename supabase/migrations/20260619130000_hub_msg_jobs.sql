CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.hub_msg_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL,
  canal TEXT NOT NULL,
  telefone TEXT NOT NULL,
  lead_id UUID NULL,
  agente_slug TEXT NULL,
  message_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_msg_jobs_status_chk CHECK (status IN ('pending', 'processing', 'done', 'retry', 'dead')),
  CONSTRAINT hub_msg_jobs_canal_message_id_key UNIQUE (canal, message_id)
);

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
