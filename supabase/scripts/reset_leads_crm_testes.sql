-- =============================================================================
-- APAGAR TODOS OS LEADS — recomeçar testes (Kanban vazio)
--
-- Supabase Dashboard → SQL Editor → colar e RUN
-- Ignora tabelas que não existem no seu projeto (ex.: hub_propostas).
-- =============================================================================

-- PRÉVIA:
-- SELECT id, codigo, nome, agente_responsavel FROM public.hub_leads_crm;

BEGIN;

SET LOCAL app.delete_authorized = true;

CREATE TEMP TABLE _reset_pessoas ON COMMIT DROP AS
SELECT DISTINCT pessoa_id AS id
FROM public.hub_leads_crm
WHERE pessoa_id IS NOT NULL;

DO $clean$
BEGIN
  -- Financeiro / negócios
  IF to_regclass('public.hub_contas_receber') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hub_contas_receber' AND column_name = 'lead_id'
    ) THEN
      IF to_regclass('public.hub_negocios') IS NOT NULL THEN
        DELETE FROM public.hub_contas_receber
        WHERE lead_id IS NOT NULL
           OR negocio_id IN (SELECT id FROM public.hub_negocios WHERE lead_id IS NOT NULL);
      ELSE
        DELETE FROM public.hub_contas_receber WHERE lead_id IS NOT NULL;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.hub_propostas') IS NOT NULL THEN
    IF to_regclass('public.hub_negocios') IS NOT NULL THEN
      DELETE FROM public.hub_propostas
      WHERE lead_id IS NOT NULL
         OR negocio_id IN (SELECT id FROM public.hub_negocios WHERE lead_id IS NOT NULL);
    ELSE
      DELETE FROM public.hub_propostas WHERE lead_id IS NOT NULL;
    END IF;
  END IF;

  IF to_regclass('public.hub_atividades') IS NOT NULL THEN
    IF to_regclass('public.hub_negocios') IS NOT NULL THEN
      DELETE FROM public.hub_atividades
      WHERE lead_id IS NOT NULL
         OR negocio_id IN (SELECT id FROM public.hub_negocios WHERE lead_id IS NOT NULL);
    ELSE
      DELETE FROM public.hub_atividades WHERE lead_id IS NOT NULL;
    END IF;
  END IF;

  IF to_regclass('public.hub_notas') IS NOT NULL THEN
    IF to_regclass('public.hub_negocios') IS NOT NULL THEN
      DELETE FROM public.hub_notas
      WHERE lead_id IS NOT NULL
         OR negocio_id IN (SELECT id FROM public.hub_negocios WHERE lead_id IS NOT NULL);
    ELSE
      DELETE FROM public.hub_notas WHERE lead_id IS NOT NULL;
    END IF;
  END IF;

  IF to_regclass('public.hub_negocios') IS NOT NULL THEN
    DELETE FROM public.hub_negocios WHERE lead_id IS NOT NULL;
  END IF;

  -- Follow-up
  IF to_regclass('public.hub_followup_envio') IS NOT NULL THEN
    DELETE FROM public.hub_followup_envio;
  END IF;

  -- WhatsApp / conversas
  IF to_regclass('public.hub_mensagens') IS NOT NULL THEN
    DELETE FROM public.hub_mensagens;
  END IF;

  IF to_regclass('public.hub_fila_mensagens') IS NOT NULL THEN
    DELETE FROM public.hub_fila_mensagens WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_conversas') IS NOT NULL THEN
    DELETE FROM public.hub_conversas;
  END IF;

  IF to_regclass('public.hub_memorias_lead') IS NOT NULL THEN
    DELETE FROM public.hub_memorias_lead;
  END IF;

  IF to_regclass('public.hub_msg_jobs') IS NOT NULL THEN
    DELETE FROM public.hub_msg_jobs WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM public.hub_prompt_logs WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_acoes_ia') IS NOT NULL THEN
    DELETE FROM public.hub_acoes_ia WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_aprovacoes') IS NOT NULL THEN
    DELETE FROM public.hub_aprovacoes WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_alertas') IS NOT NULL THEN
    DELETE FROM public.hub_alertas WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_arquivos') IS NOT NULL THEN
    DELETE FROM public.hub_arquivos WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_conversas_log') IS NOT NULL THEN
    DELETE FROM public.hub_conversas_log WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_briefings') IS NOT NULL THEN
    DELETE FROM public.hub_briefings WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_encaminhamentos') IS NOT NULL THEN
    DELETE FROM public.hub_encaminhamentos WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_email_sync_state') IS NOT NULL THEN
    UPDATE public.hub_email_sync_state SET lead_id = NULL WHERE lead_id IS NOT NULL;
  END IF;

  IF to_regclass('public.hub_logs') IS NOT NULL THEN
    DELETE FROM public.hub_logs
    WHERE entidade IN ('lead', 'hub_leads_crm', 'hub_lead')
       OR entidade_id IN (SELECT id FROM public.hub_leads_crm);
  END IF;

  IF to_regclass('public.hub_ciclos_log') IS NOT NULL THEN
    DELETE FROM public.hub_ciclos_log
    WHERE acoes_tomadas->>'acao' IN ('followup_automatico', 'followup_tick');
  END IF;

  IF to_regclass('public.hub_decision_logs') IS NOT NULL THEN
    DELETE FROM public.hub_decision_logs WHERE lead_id IS NOT NULL;
  END IF;
END $clean$;

-- Leads (obrigatório)
DELETE FROM public.hub_leads_crm;

-- Pessoas dos leads apagados
DELETE FROM public.hub_pessoas p
WHERE p.id IN (SELECT id FROM _reset_pessoas)
   OR (p.tipo = 'lead' AND NOT EXISTS (
     SELECT 1 FROM public.hub_leads_crm l WHERE l.pessoa_id = p.id
   ));

COMMIT;

-- CONFIRME:
-- SELECT COUNT(*) AS leads_restantes FROM public.hub_leads_crm;
