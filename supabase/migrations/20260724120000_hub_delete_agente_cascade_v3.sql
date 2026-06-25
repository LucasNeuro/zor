-- v3: follow-up + limpeza de ciclos órfãos; reforça hub_delete_agente_cascade.

CREATE OR REPLACE FUNCTION public.hub_purge_orphan_ciclos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF to_regclass('public.hub_ciclos_ia') IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', 0);
  END IF;

  SET LOCAL app.delete_authorized = true;

  IF to_regclass('public.hub_ciclos_log') IS NOT NULL THEN
    DELETE FROM hub_ciclos_log
    WHERE ciclo_id IN (
      SELECT c.id
      FROM hub_ciclos_ia c
      WHERE NOT EXISTS (
        SELECT 1 FROM hub_agente_identidade i WHERE i.agente_slug = c.agente_slug
      )
    );
  END IF;

  DELETE FROM hub_ciclos_ia c
  WHERE NOT EXISTS (
    SELECT 1 FROM hub_agente_identidade i WHERE i.agente_slug = c.agente_slug
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.hub_purge_orphan_ciclos() IS
  'Remove ciclos cujo agente_slug já não existe em hub_agente_identidade.';

REVOKE ALL ON FUNCTION public.hub_purge_orphan_ciclos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_purge_orphan_ciclos() TO service_role;

-- Atualiza exclusão do agente (follow-up e demais satélites recentes).
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

  IF to_regclass('public.hub_agente_rag_chunks') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_chunks WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_agente_rag_documentos') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_documentos WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_ciclos_log') IS NOT NULL THEN
    DELETE FROM hub_ciclos_log
    WHERE agente_slug = p_agente_slug
       OR ciclo_id IN (SELECT id FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug);
  END IF;
  IF to_regclass('public.hub_ciclos_ia') IS NOT NULL THEN
    DELETE FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_agente_followup_passo') IS NOT NULL
     AND to_regclass('public.hub_agente_followup_config') IS NOT NULL THEN
    DELETE FROM hub_agente_followup_passo WHERE agente_slug = p_agente_slug;
    DELETE FROM hub_agente_followup_config WHERE agente_slug = p_agente_slug;
  END IF;

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

  IF to_regclass('public.hub_leads_crm') IS NOT NULL THEN
    UPDATE hub_leads_crm SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_ml_historico') IS NOT NULL THEN
    DELETE FROM hub_ml_historico WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_ml_sugestoes') IS NOT NULL THEN
    DELETE FROM hub_ml_sugestoes
    WHERE agente_slug = p_agente_slug OR supervisor_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_ml_observacoes') IS NOT NULL THEN
    DELETE FROM hub_ml_observacoes WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_responsabilidades') IS NOT NULL THEN
    DELETE FROM hub_responsabilidades
    WHERE supervisor_slug = p_agente_slug OR subordinado_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_kpis_resultados') IS NOT NULL THEN
    DELETE FROM hub_kpis_resultados WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_kpis_metas') IS NOT NULL THEN
    DELETE FROM hub_kpis_metas WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_acoes_ia') IS NOT NULL THEN
    DELETE FROM hub_acoes_ia WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_qualidade_agente') IS NOT NULL THEN
    DELETE FROM hub_qualidade_agente WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_aprovacoes') IS NOT NULL THEN
    DELETE FROM hub_aprovacoes WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_alertas') IS NOT NULL THEN
    DELETE FROM hub_alertas WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_regras_ia') IS NOT NULL THEN
    DELETE FROM hub_regras_ia WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_agente_conhecimento') IS NOT NULL THEN
    DELETE FROM hub_agente_conhecimento WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_personalidade') IS NOT NULL THEN
    DELETE FROM hub_personalidade WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_memorias_agente') IS NOT NULL THEN
    DELETE FROM hub_memorias_agente WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_arquivos') IS NOT NULL THEN
    DELETE FROM hub_arquivos WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_crm_agente_briefing_sessao') IS NOT NULL THEN
    DELETE FROM hub_crm_agente_briefing_sessao WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_autonomia_matriz') IS NOT NULL THEN
    DELETE FROM hub_autonomia_matriz WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_hierarquia') IS NOT NULL THEN
    UPDATE hub_hierarquia SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
    UPDATE hub_hierarquia SET supervisor_slug = NULL WHERE supervisor_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_fluxos') IS NOT NULL THEN
    UPDATE hub_fluxos SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_briefings') IS NOT NULL THEN
    UPDATE hub_briefings SET agente_solicitante = NULL WHERE agente_solicitante = p_agente_slug;
    UPDATE hub_briefings SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_agente_configuracao') IS NOT NULL THEN
    DELETE FROM hub_agente_configuracao WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_scripts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hub_scripts' AND column_name = 'agente_slug'
    ) THEN
      DELETE FROM hub_scripts WHERE agente_slug = p_agente_slug;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hub_scripts' AND column_name = 'agente_id'
    ) THEN
      DELETE FROM hub_scripts WHERE agente_id = v_id;
    END IF;
  END IF;

  IF to_regclass('public.hub_regras_negocio') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hub_regras_negocio' AND column_name = 'agente_id'
    ) THEN
      DELETE FROM hub_regras_negocio WHERE agente_id = v_id;
    END IF;
  END IF;

  IF to_regclass('public.hub_ml_padroes') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hub_ml_padroes' AND column_name = 'agente_id'
    ) THEN
      DELETE FROM hub_ml_padroes WHERE agente_id = v_id;
    END IF;
  END IF;

  DELETE FROM hub_agente_identidade WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_agente_cascade(text) IS
  'Apaga agente, ciclos, follow-up, RAG, conversas/logs, fila e satélites; Storage via app.';

REVOKE ALL ON FUNCTION public.hub_delete_agente_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_agente_cascade(text) TO service_role;
