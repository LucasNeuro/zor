-- =============================================================================
-- Reset completo: remove TODOS os agentes em hub_agente_identidade e dados
-- satélites que usam agente_slug sem FK (orfs) ou que referenciam slugs em texto.
--
-- Onde executar: Supabase Dashboard → SQL Editor (role postgres / bypass RLS).
-- ATENÇÃO: irreversível. Leads/CRM em hub_leads_crm ficam; só limpa
--           agente_responsavel se coincidir com um slug a apagar.
--
-- Depois: cria um agente novo pelo CRM (wizard → POST /api/hub/agentes).
-- Opcional: no Storage, apagar objetos antigos em `hub-agent-playbooks`.
--
-- hub_cargos_catalogo: NÃO apagar para “limpar agentes”. É o catálogo de cargos
-- (títulos/modelo); os agentes só guardam texto `cargo` alinhado a esse catálogo.
--
-- Filhas que na produção podem ter FK para hub_agente_identidade SEM CASCADE
-- (causa 23503 se apagares só o pai): hub_agente_configuracao, hub_autonomia_matriz,
-- hub_crm_agente_briefing_sessao, hub_scripts, hub_regras_negocio, hub_ml_padroes.
-- O script abaixo apaga-as explicitamente antes do DELETE final.
--
-- Produção (SISTEMA OBRA10+): existe trigger `block_unauthorized_delete` que
-- bloqueia DELETE sem autorização. É obrigatório na mesma transação:
--   SET LOCAL app.delete_authorized = true;
-- (ver mensagem P0001 se faltar)
-- =============================================================================

BEGIN;

-- Desliga o bloqueio administrativo de DELETE nesta transação (só até ao COMMIT)
SET LOCAL app.delete_authorized = true;

-- Referências soltas em CRM / fila (texto livre, sem FK)
UPDATE public.hub_leads_crm
SET agente_responsavel = NULL
WHERE agente_responsavel IS NOT NULL
  AND agente_responsavel IN (SELECT agente_slug FROM public.hub_agente_identidade);

UPDATE public.hub_fila_mensagens
SET agente_responsavel = NULL
WHERE agente_responsavel IS NOT NULL
  AND agente_responsavel IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- Ciclos: log antes da definição do ciclo (se existir FK ciclo_id → hub_ciclos_ia)
DELETE FROM public.hub_ciclos_log
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade)
   OR ciclo_id IN (
     SELECT id FROM public.hub_ciclos_ia
     WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade)
   );

DELETE FROM public.hub_ciclos_ia
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- ML / KPIs / ações (ordem: dependências de sugestões/histórico)
DELETE FROM public.hub_ml_historico
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_ml_sugestoes
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade)
   OR supervisor_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_ml_observacoes
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_responsabilidades
WHERE supervisor_slug IN (SELECT agente_slug FROM public.hub_agente_identidade)
   OR subordinado_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_kpis_resultados
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_kpis_metas
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_acoes_ia
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- Qualidade / aprovações / alertas
DELETE FROM public.hub_qualidade_agente
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_aprovacoes
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_alertas
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- Playbook layer (sem FK para identidade no legado)
DELETE FROM public.hub_regras_ia
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_agente_conhecimento
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_personalidade
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- Métricas / ficheiros / conversas log: manter linhas, limpar slug
UPDATE public.hub_arquivos
SET agente_slug = NULL
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

UPDATE public.hub_conversas_log
SET agente_slug = NULL
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

UPDATE public.hub_prompt_logs
SET agente_slug = NULL
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

-- Filhas directas de hub_agente_identidade (evita 23503 se FK não tiver ON DELETE CASCADE)
DELETE FROM public.hub_crm_agente_briefing_sessao
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_autonomia_matriz
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_agente_configuracao
WHERE agente_slug IN (SELECT agente_slug FROM public.hub_agente_identidade);

DELETE FROM public.hub_scripts
WHERE agente_id IN (SELECT id FROM public.hub_agente_identidade);

DELETE FROM public.hub_regras_negocio
WHERE agente_id IN (SELECT id FROM public.hub_agente_identidade);

DELETE FROM public.hub_ml_padroes
WHERE agente_id IN (SELECT id FROM public.hub_agente_identidade);

-- Identidade (pai). Se ainda falhar 23503, procura outras FKs:
-- SELECT conrelid::regclass AS tabela, conname
-- FROM pg_constraint WHERE confrelid = 'public.hub_agente_identidade'::regclass;
DELETE FROM public.hub_agente_identidade;

COMMIT;

-- Se algum DELETE falhar (tabela inexistente no teu projeto), comenta a secção
-- correspondente ou cria a tabela vazia antes de repetir.
