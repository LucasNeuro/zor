-- Auditoria: motor de ferramentas e tools activas por agente Hub.
-- Executar no Supabase SQL Editor ou via: npm run audit:ferramentas

CREATE OR REPLACE VIEW public.vw_hub_auditoria_ferramentas_agentes AS
SELECT
  i.agente_slug,
  i.nome,
  i.ativo AS agente_ativo,
  i.modo_operacao,
  i.modelo_padrao,
  COALESCE(i.motor_ferramentas_habilitado, false) AS motor_ferramentas,
  COALESCE(i.mistral_agent_sync_habilitado, false) AS mistral_sync,
  i.mistral_agent_id,
  i.mistral_agent_sync_em,
  LEFT(COALESCE(i.mistral_agent_sync_erro, ''), 120) AS mistral_sync_erro_resumo,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_lead_resumo')::boolean, false) AS tool_lead_resumo,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_lead_memorias')::boolean, false) AS tool_lead_memorias,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_lead_lookup_por_telefone')::boolean, false) AS tool_lead_lookup,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_metricas_escritorio')::boolean, false) AS tool_metricas,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_relatorio_html_simples')::boolean, false) AS tool_relatorio_html,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_registar_nota_lead')::boolean, false) AS tool_registar_nota,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_whatsapp_menu')::boolean, false) AS tool_whatsapp_menu,
  COALESCE((i.uso_ferramentas_ia ->> 'hub_atualizar_lead')::boolean, false) AS tool_atualizar_lead,
  (
    SELECT COUNT(*)::int
    FROM jsonb_each(COALESCE(i.uso_ferramentas_ia, '{}'::jsonb)) AS kv(key, val)
    WHERE kv.key LIKE 'hub_custom_%' AND kv.val::text IN ('true', '1')
  ) AS tools_custom_ativas,
  (
    SELECT COUNT(*)::int
    FROM jsonb_each(COALESCE(i.uso_ferramentas_ia, '{}'::jsonb)) AS kv(key, val)
    WHERE kv.val::text IN ('true', '1')
  ) AS total_tools_ativas,
  CASE
    WHEN NOT COALESCE(i.motor_ferramentas_habilitado, false) THEN 'motor_desligado'
    WHEN (
      SELECT COUNT(*) FROM jsonb_each(COALESCE(i.uso_ferramentas_ia, '{}'::jsonb)) AS kv(key, val)
      WHERE kv.val::text IN ('true', '1')
    ) = 0 THEN 'motor_ligado_sem_tools'
    WHEN i.modo_operacao = 'canal_whatsapp'
      AND COALESCE((i.uso_ferramentas_ia ->> 'hub_whatsapp_menu')::boolean, false) = false
      AND COALESCE((i.uso_ferramentas_ia ->> 'hub_atualizar_lead')::boolean, false) = true
      THEN 'whatsapp_sem_menu_interactivo'
    ELSE 'ok'
  END AS alerta,
  i.uso_ferramentas_ia
FROM public.hub_agente_identidade i
ORDER BY i.ativo DESC, i.nome NULLS LAST, i.agente_slug;

COMMENT ON VIEW public.vw_hub_auditoria_ferramentas_agentes IS
  'Auditoria operacional: motor Mistral tools, toggles por agente e alertas comuns antes de deploy.';

-- Resumo rápido
-- SELECT alerta, COUNT(*) FROM vw_hub_auditoria_ferramentas_agentes GROUP BY alerta ORDER BY 2 DESC;
-- SELECT * FROM vw_hub_auditoria_ferramentas_agentes WHERE alerta <> 'ok';
