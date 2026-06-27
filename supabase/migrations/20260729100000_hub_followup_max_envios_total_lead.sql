-- Teto de follow-ups automáticos por lead (vida toda), independente de dia/mês.

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS max_envios_total_lead INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.hub_agente_followup_config.max_envios_total_lead IS
  'Máximo de follow-ups automáticos por lead (total histórico), independente de dia ou mês.';

UPDATE public.hub_agente_followup_config
SET max_envios_total_lead = GREATEST(max_envios_total_lead, 10)
WHERE max_envios_total_lead < 2;
