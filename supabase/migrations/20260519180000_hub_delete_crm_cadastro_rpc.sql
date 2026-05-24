-- Exclusão de contactos/empresas no CRM com SET LOCAL app.delete_authorized = true
-- (obrigatório quando existe trigger block_unauthorized_delete em hub_pessoas / hub_empresas).

CREATE OR REPLACE FUNCTION public.hub_delete_pessoa_crm(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row hub_pessoas%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID inválido');
  END IF;

  SELECT * INTO v_row FROM hub_pessoas WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pessoa não encontrada.');
  END IF;

  UPDATE hub_leads_crm SET pessoa_id = NULL WHERE pessoa_id = p_id;
  UPDATE hub_negocios SET pessoa_id = NULL WHERE pessoa_id = p_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_leads' AND column_name = 'pessoa_id'
  ) THEN
    UPDATE hub_leads SET pessoa_id = NULL WHERE pessoa_id = p_id;
  END IF;

  SET LOCAL app.delete_authorized = true;
  DELETE FROM hub_pessoas WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok',
    true,
    'id',
    p_id,
    'codigo',
    v_row.codigo,
    'nome',
    v_row.nome
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'Não é possível excluir: este cadastro está vinculado a outros registros do sistema.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_delete_empresa_crm(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row hub_empresas%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID inválido');
  END IF;

  SELECT * INTO v_row FROM hub_empresas WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empresa não encontrada.');
  END IF;

  SET LOCAL app.delete_authorized = true;
  DELETE FROM hub_empresas WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok',
    true,
    'id',
    p_id,
    'codigo',
    v_row.codigo,
    'razao_social',
    v_row.razao_social
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'Não é possível excluir: esta empresa está vinculada a outros registros do sistema.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_pessoa_crm(uuid) IS
  'Apaga contacto em hub_pessoas; desvincula leads/negócios; usa app.delete_authorized.';

COMMENT ON FUNCTION public.hub_delete_empresa_crm(uuid) IS
  'Apaga empresa em hub_empresas; usa app.delete_authorized.';

REVOKE ALL ON FUNCTION public.hub_delete_pessoa_crm(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_delete_empresa_crm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_pessoa_crm(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_delete_empresa_crm(uuid) TO service_role;
