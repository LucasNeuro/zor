-- Exclusão em cascata de um agente com SET LOCAL app.delete_authorized = true
-- na mesma transação (obrigatório quando existe trigger block_unauthorized_delete).
-- Chamada via PostgREST: rpc('hub_delete_agente_cascade', { p_agente_slug: '...' }).

CREATE OR REPLACE FUNCTION public.hub_delete_agente_cascade(p_agente_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_agente_slug IS NULL OR length(trim(p_agente_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agente_slug inválido');
  END IF;

  SET LOCAL app.delete_authorized = true;

  SELECT id INTO v_id
  FROM hub_agente_identidade
  WHERE agente_slug = p_agente_slug
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agente não encontrado');
  END IF;

  DELETE FROM hub_ciclos_log
  WHERE agente_slug = p_agente_slug
     OR ciclo_id IN (SELECT id FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug);

  DELETE FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug;

  UPDATE hub_leads_crm SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;
  UPDATE hub_fila_mensagens SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;

  DELETE FROM hub_ml_historico WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_ml_sugestoes
  WHERE agente_slug = p_agente_slug OR supervisor_slug = p_agente_slug;
  DELETE FROM hub_ml_observacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_responsabilidades
  WHERE supervisor_slug = p_agente_slug OR subordinado_slug = p_agente_slug;

  DELETE FROM hub_kpis_resultados WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_kpis_metas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_acoes_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_qualidade_agente WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_aprovacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_alertas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_regras_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_conhecimento WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_personalidade WHERE agente_slug = p_agente_slug;

  UPDATE hub_arquivos SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
  UPDATE hub_conversas_log SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
  UPDATE hub_prompt_logs SET agente_slug = NULL WHERE agente_slug = p_agente_slug;

  DELETE FROM hub_crm_agente_briefing_sessao WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_autonomia_matriz WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_configuracao WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_scripts WHERE agente_id = v_id;
  DELETE FROM hub_regras_negocio WHERE agente_id = v_id;
  DELETE FROM hub_ml_padroes WHERE agente_id = v_id;

  DELETE FROM hub_agente_identidade WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_agente_cascade(text) IS
  'Apaga um agente e satélites; usa SET LOCAL app.delete_authorized = true (trigger delete).';

REVOKE ALL ON FUNCTION public.hub_delete_agente_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_agente_cascade(text) TO service_role;
