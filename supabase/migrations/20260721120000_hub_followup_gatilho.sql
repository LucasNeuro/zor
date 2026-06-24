-- Gatilho de disparo (silêncio ou hora do dia) + atraso em dias por passo.

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS gatilho_tipo TEXT NOT NULL DEFAULT 'silencio'
    CHECK (gatilho_tipo IN ('silencio', 'horario'));

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS gatilho_dias INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS gatilho_horas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS gatilho_minutos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS gatilho_hora_dia TEXT;

ALTER TABLE public.hub_agente_followup_config
  DROP CONSTRAINT IF EXISTS hub_agente_followup_config_gatilho_dias_check;

ALTER TABLE public.hub_agente_followup_config
  ADD CONSTRAINT hub_agente_followup_config_gatilho_dias_check
  CHECK (gatilho_dias >= 0 AND gatilho_dias <= 365);

ALTER TABLE public.hub_agente_followup_config
  DROP CONSTRAINT IF EXISTS hub_agente_followup_config_gatilho_horas_check;

ALTER TABLE public.hub_agente_followup_config
  ADD CONSTRAINT hub_agente_followup_config_gatilho_horas_check
  CHECK (gatilho_horas >= 0 AND gatilho_horas <= 8760);

ALTER TABLE public.hub_agente_followup_config
  DROP CONSTRAINT IF EXISTS hub_agente_followup_config_gatilho_minutos_check;

ALTER TABLE public.hub_agente_followup_config
  ADD CONSTRAINT hub_agente_followup_config_gatilho_minutos_check
  CHECK (gatilho_minutos >= 0 AND gatilho_minutos <= 59);

ALTER TABLE public.hub_agente_followup_passo
  ADD COLUMN IF NOT EXISTS atraso_dias INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.hub_agente_followup_passo
  ADD COLUMN IF NOT EXISTS disparo_hora_dia TEXT;

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_dias_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_dias_check
  CHECK (atraso_dias >= 0 AND atraso_dias <= 365);

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_total_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_total_check
  CHECK (
    (atraso_dias * 1440 + atraso_horas * 60 + atraso_minutos) >= 1
    AND (atraso_dias * 1440 + atraso_horas * 60 + atraso_minutos) <= 525600
  );

COMMENT ON COLUMN public.hub_agente_followup_config.gatilho_tipo IS
  'silencio = após tempo sem resposta; horario = também exige hora do dia (HH:MM).';
COMMENT ON COLUMN public.hub_agente_followup_config.gatilho_hora_dia IS
  'Hora local (HH:MM) mínima para disparo quando gatilho_tipo = horario.';
COMMENT ON COLUMN public.hub_agente_followup_passo.atraso_dias IS
  'Dias de silêncio do cliente (somados a horas/minutos) antes deste passo.';
COMMENT ON COLUMN public.hub_agente_followup_passo.disparo_hora_dia IS
  'Opcional: não enviar este passo antes desta hora local (HH:MM).';
