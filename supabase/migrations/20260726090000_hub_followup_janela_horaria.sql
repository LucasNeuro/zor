-- Modo seguro: follow-up só em janelas horárias configuradas (evita spam 24/7).

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS execucao_modo TEXT NOT NULL DEFAULT 'janela_horaria';

ALTER TABLE public.hub_agente_followup_config
  DROP CONSTRAINT IF EXISTS hub_agente_followup_config_execucao_modo_check;

ALTER TABLE public.hub_agente_followup_config
  ADD CONSTRAINT hub_agente_followup_config_execucao_modo_check
  CHECK (execucao_modo IN ('continuo', 'janela_horaria'));

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS horarios_disparo JSONB NOT NULL DEFAULT '["09:00","14:00","18:00"]'::jsonb;

COMMENT ON COLUMN public.hub_agente_followup_config.execucao_modo IS
  'continuo = worker/cron avaliam cadência a qualquer hora; janela_horaria = só dispara nos horários de horarios_disparo.';
COMMENT ON COLUMN public.hub_agente_followup_config.horarios_disparo IS
  'Lista HH:MM (America/Sao_Paulo) em que o follow-up pode rodar — ex. ["09:00","14:00","18:00"].';
