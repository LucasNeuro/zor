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
