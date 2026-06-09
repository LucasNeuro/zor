-- Elimina uma linha de hub_cargos_catalogo na mesma transação que
-- SET LOCAL app.delete_authorized = true (obrigatório com trigger block_unauthorized_delete).

CREATE OR REPLACE FUNCTION public.hub_delete_cargo_catalogo(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := trim(both from COALESCE(p_slug, ''));
  v_titulo text;
  v_count int;
BEGIN
  IF length(v_slug) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug inválido');
  END IF;

  SELECT trim(both from COALESCE(titulo::text, nome::text, ''))
  INTO v_titulo
  FROM hub_cargos_catalogo
  WHERE slug = v_slug;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cargo não encontrado.');
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM hub_agente_identidade WHERE cargo = v_titulo;

  IF COALESCE(v_count, 0) > 0 THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      format(
        'Não é possível eliminar: %s agente(s) usam o cargo «%s». Desactive o cargo ou actualize os agentes.',
        v_count,
        v_titulo
      )
    );
  END IF;

  SET LOCAL app.delete_authorized = true;

  DELETE FROM hub_cargos_catalogo WHERE slug = v_slug;

  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_cargo_catalogo(text) IS
  'Apaga cargo do catálogo após validar uso por agentes; usa SET LOCAL app.delete_authorized = true.';

REVOKE ALL ON FUNCTION public.hub_delete_cargo_catalogo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_cargo_catalogo(text) TO service_role;
