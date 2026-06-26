-- =============================================================================
-- Reset de LEADS para recomeçar testes (WhatsApp / follow-up / CRM)
--
-- Onde executar: Supabase Dashboard → SQL Editor (role postgres)
--
-- MANTÉM: tenants, users, agentes, hub_agente_followup_config/passos,
--         pipelines, catálogos, integrações.
-- APAGA: todos os leads e histórico ligado (mensagens, ledger follow-up, etc.)
--
-- Produção Obra10+/Synkron: pode exigir autorização de DELETE:
--   SET LOCAL app.delete_authorized = true;
--
-- Antes de apagar tudo, descomente o bloco "PRÉVIA" no final.
-- =============================================================================

BEGIN;

SET LOCAL app.delete_authorized = true;

-- ─── Opcional: limitar a um tenant ─────────────────────────────────────────
-- Descomente e ajuste o UUID se quiser só um tenant piloto:
-- \set tenant_id '00000000-0000-4000-8000-000000000001'

-- ─── Opcional: limitar a um agente (ex. dany) ───────────────────────────────
-- Comente a linha abaixo para apagar TODOS os leads do tenant.
-- Para todos os agentes, use: AND TRUE
DO $$
DECLARE
  v_agente text := NULL;  -- ex: 'dany' — ou NULL para todos
BEGIN
  CREATE TEMP TABLE _leads_reset ON COMMIT DROP AS
  SELECT l.id, l.pessoa_id
  FROM public.hub_leads_crm l
  WHERE (v_agente IS NULL OR l.agente_responsavel = v_agente);

  IF NOT EXISTS (SELECT 1 FROM _leads_reset) THEN
    RAISE NOTICE 'Nenhum lead encontrado para reset.';
  END IF;

  -- Negócios / financeiro (FK hub_negocios → lead bloqueia DELETE no lead)
  DELETE FROM public.hub_contas_receber cr
  WHERE cr.lead_id IN (SELECT id FROM _leads_reset)
     OR cr.negocio_id IN (
       SELECT n.id FROM public.hub_negocios n
       WHERE n.lead_id IN (SELECT id FROM _leads_reset)
     );

  DELETE FROM public.hub_propostas pr
  WHERE pr.lead_id IN (SELECT id FROM _leads_reset)
     OR pr.negocio_id IN (
       SELECT n.id FROM public.hub_negocios n
       WHERE n.lead_id IN (SELECT id FROM _leads_reset)
     );

  DELETE FROM public.hub_atividades a
  WHERE a.lead_id IN (SELECT id FROM _leads_reset)
     OR a.negocio_id IN (
       SELECT n.id FROM public.hub_negocios n
       WHERE n.lead_id IN (SELECT id FROM _leads_reset)
     );

  DELETE FROM public.hub_notas no
  WHERE no.lead_id IN (SELECT id FROM _leads_reset)
     OR no.negocio_id IN (
       SELECT n.id FROM public.hub_negocios n
       WHERE n.lead_id IN (SELECT id FROM _leads_reset)
     );

  DELETE FROM public.hub_negocios n
  WHERE n.lead_id IN (SELECT id FROM _leads_reset);

  -- Follow-up: ledger impede reenvio duplicado nos testes
  DELETE FROM public.hub_followup_envio fe
  WHERE fe.lead_id IN (SELECT id FROM _leads_reset);

  -- Conversas WhatsApp / fila CRM
  DELETE FROM public.hub_mensagens m
  WHERE m.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_fila_mensagens fm
  WHERE fm.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_conversas c
  WHERE c.lead_id IN (SELECT id FROM _leads_reset);

  -- Memória IA por lead
  DELETE FROM public.hub_memorias_lead ml
  WHERE ml.lead_id IN (SELECT id FROM _leads_reset);

  -- Jobs / logs / aprovações
  DELETE FROM public.hub_msg_jobs j
  WHERE j.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_prompt_logs pl
  WHERE pl.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_acoes_ia ai
  WHERE ai.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_aprovacoes ap
  WHERE ap.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_alertas al
  WHERE al.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_arquivos ar
  WHERE ar.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_conversas_log cl
  WHERE cl.lead_id IN (SELECT id FROM _leads_reset);

  DELETE FROM public.hub_briefings bf
  WHERE bf.lead_id IN (SELECT id FROM _leads_reset);

  -- Tabelas legadas / sem CASCADE garantido
  DELETE FROM public.hub_encaminhamentos enc
  WHERE enc.lead_id IN (SELECT id FROM _leads_reset);

  UPDATE public.hub_email_sync_state es
  SET lead_id = NULL
  WHERE es.lead_id IN (SELECT id FROM _leads_reset);

  -- Ruído nos ticks de follow-up (aba Operação do agente)
  DELETE FROM public.hub_ciclos_log lg
  WHERE lg.acoes_tomadas->>'acao' IN ('followup_automatico', 'followup_tick')
    AND (
      v_agente IS NULL
      OR lg.agente_slug = v_agente
      OR lg.acoes_tomadas->>'lead_id' IN (SELECT id::text FROM _leads_reset)
    );

  -- Leads
  DELETE FROM public.hub_leads_crm l
  WHERE l.id IN (SELECT id FROM _leads_reset);

  -- Pessoas ligadas a esses leads (cadastro CRM)
  DELETE FROM public.hub_pessoas p
  WHERE p.id IN (SELECT pessoa_id FROM _leads_reset WHERE pessoa_id IS NOT NULL);

  RAISE NOTICE 'Reset concluído. Leads removidos: %', (SELECT COUNT(*) FROM _leads_reset);
END $$;

COMMIT;

-- ─── PRÉVIA (rode separado ANTES do reset) ─────────────────────────────────
-- SELECT COUNT(*) AS leads FROM public.hub_leads_crm;
-- SELECT COUNT(*) AS ledger FROM public.hub_followup_envio;
-- SELECT COUNT(*) AS fila_followup FROM public.hub_fila_mensagens
--   WHERE metadata->>'tipo' = 'followup_automatico';
-- SELECT agente_responsavel, COUNT(*) FROM public.hub_leads_crm GROUP BY 1;
