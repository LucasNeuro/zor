-- Permite atraso 0 no primeiro passo (disparo só pelo gatilho) e ajusta comentários ao modelo incremental.

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_atraso_total_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_atraso_total_check
  CHECK (
    (atraso_dias * 1440 + atraso_horas * 60 + atraso_minutos) >= 0
    AND (atraso_dias * 1440 + atraso_horas * 60 + atraso_minutos) <= 525600
  );

COMMENT ON COLUMN public.hub_agente_followup_passo.atraso_dias IS
  'Passo 1: tempo extra após o gatilho. Passos seguintes: tempo após o passo anterior enviado.';
COMMENT ON COLUMN public.hub_agente_followup_passo.atraso_horas IS
  'Ver atraso_dias — somado a minutos/dias para o atraso deste passo.';
COMMENT ON COLUMN public.hub_agente_followup_passo.atraso_minutos IS
  'Ver atraso_dias — somado a horas/dias para o atraso deste passo.';

COMMENT ON COLUMN public.hub_leads_crm.followup_passo IS
  'Quantidade de passos da cadência já enviados (0 = nenhum). Reinicia quando o cliente responde.';
