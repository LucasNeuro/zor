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

COMMENT ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) IS
  'Tenta lock exclusivo por telefone da conversa usando pg_try_advisory_lock.';
COMMENT ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) IS
  'Libera lock exclusivo por telefone da conversa usando pg_advisory_unlock.';

REVOKE ALL ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) TO service_role;
