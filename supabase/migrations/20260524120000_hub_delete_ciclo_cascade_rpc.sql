-- Exclusão em cascata de um ciclo: hub_ciclos_log (ciclo_id) + hub_ciclos_ia,
-- com SET LOCAL app.delete_authorized = true quando existir trigger de bloqueio.

CREATE OR REPLACE FUNCTION public.hub_delete_ciclo_cascade(p_ciclo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ciclo_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ciclo_id inválido');
  END IF;

  SET LOCAL app.delete_authorized = true;

  IF NOT EXISTS (SELECT 1 FROM hub_ciclos_ia WHERE id = p_ciclo_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ciclo não encontrado');
  END IF;

  DELETE FROM hub_ciclos_log WHERE ciclo_id = p_ciclo_id;
  DELETE FROM hub_ciclos_ia WHERE id = p_ciclo_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_ciclo_cascade(uuid) IS
  'Apaga hub_ciclos_log do ciclo e a linha em hub_ciclos_ia; respeita app.delete_authorized.';

REVOKE ALL ON FUNCTION public.hub_delete_ciclo_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_ciclo_cascade(uuid) TO service_role;
