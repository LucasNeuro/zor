-- Novos agentes e configs legadas em slots passam a faixa horária ajustável (08–22).
-- Quem precisar de slots fixos 09/14/18 pode voltar a janela_modo = 'slots' no CRM.

UPDATE public.hub_agente_followup_config
SET
  janela_modo = 'faixa',
  horario_inicio = COALESCE(NULLIF(TRIM(horario_inicio), ''), '08:00'),
  horario_fim = COALESCE(NULLIF(TRIM(horario_fim), ''), '22:00'),
  timezone = COALESCE(NULLIF(TRIM(timezone), ''), 'America/Sao_Paulo'),
  max_envios_por_dia = COALESCE(max_envios_por_dia, 1)
WHERE janela_modo = 'slots'
  AND execucao_modo = 'janela_horaria';

COMMENT ON COLUMN public.hub_agente_followup_config.horario_inicio IS
  'Faixa horária início (HH:MM) — envios permitidos a partir desta hora no timezone do agente.';
COMMENT ON COLUMN public.hub_agente_followup_config.horario_fim IS
  'Faixa horária fim (HH:MM) — envios permitidos até antes desta hora no timezone do agente.';
