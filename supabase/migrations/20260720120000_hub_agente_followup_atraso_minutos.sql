-- Atraso por passo em horas + minutos (testes rápidos em produção).

ALTER TABLE public.hub_agente_followup_passo
  ADD COLUMN IF NOT EXISTS atraso_minutos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_horas_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_horas_check
  CHECK (atraso_horas >= 0 AND atraso_horas <= 8760);

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_minutos_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_minutos_check
  CHECK (atraso_minutos >= 0 AND atraso_minutos <= 59);

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_total_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_total_check
  CHECK ((atraso_horas * 60 + atraso_minutos) >= 1 AND (atraso_horas * 60 + atraso_minutos) <= 525600);

COMMENT ON COLUMN public.hub_agente_followup_passo.atraso_minutos IS
  'Minutos adicionais ao atraso em horas desde a última mensagem do cliente.';

COMMENT ON TABLE public.hub_agente_followup_passo IS
  'Passos de lembrete: atraso (horas + minutos) desde última mensagem do cliente.';
