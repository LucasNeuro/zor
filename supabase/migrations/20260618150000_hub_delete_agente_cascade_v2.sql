-- Exclusão completa do agente: RAG, conversas, embeddings, playbook layer, etc.
-- Substitui hub_delete_agente_cascade com limpeza real (DELETE, não só NULL em logs).

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

  -- RAG: chunks e documentos (embeddings pgvector) antes do pai
  IF to_regclass('public.hub_agente_rag_chunks') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_chunks WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_agente_rag_documentos') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_documentos WHERE agente_slug = p_agente_slug;
  END IF;

  -- Ciclos
  DELETE FROM hub_ciclos_log
  WHERE agente_slug = p_agente_slug
     OR ciclo_id IN (SELECT id FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug);

  DELETE FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug;

  -- Conversas / mensagens / fila / prompts (apagar, não anonimizar)
  IF to_regclass('public.hub_mensagens') IS NOT NULL AND to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_mensagens
    WHERE conversa_id IN (
      SELECT DISTINCT conversa_id
      FROM hub_prompt_logs
      WHERE agente_slug = p_agente_slug AND conversa_id IS NOT NULL
    );
  END IF;

  IF to_regclass('public.hub_conversas') IS NOT NULL AND to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_conversas
    WHERE id IN (
      SELECT DISTINCT conversa_id
      FROM hub_prompt_logs
      WHERE agente_slug = p_agente_slug AND conversa_id IS NOT NULL
    );
  END IF;

  IF to_regclass('public.hub_conversas_log') IS NOT NULL THEN
    DELETE FROM hub_conversas_log WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_prompt_logs WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_fila_mensagens') IS NOT NULL THEN
    DELETE FROM hub_fila_mensagens WHERE agente_responsavel = p_agente_slug;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hub_fila_mensagens'
        AND column_name = 'agente_id'
    ) THEN
      EXECUTE 'DELETE FROM hub_fila_mensagens WHERE agente_id = $1' USING p_agente_slug;
    END IF;
  END IF;

  UPDATE hub_leads_crm SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;

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

  IF to_regclass('public.hub_arquivos') IS NOT NULL THEN
    DELETE FROM hub_arquivos WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_crm_agente_briefing_sessao') IS NOT NULL THEN
    DELETE FROM hub_crm_agente_briefing_sessao WHERE agente_slug = p_agente_slug;
  END IF;

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
  'Apaga agente, RAG (chunks/embeddings), conversas/logs, fila, ciclos e satélites; Storage via app.';

REVOKE ALL ON FUNCTION public.hub_delete_agente_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_agente_cascade(text) TO service_role;
