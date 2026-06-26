-- Campo único de espera por passo (minutos) — simplifica gatilho + atraso legado.

ALTER TABLE public.hub_agente_followup_passo
  ADD COLUMN IF NOT EXISTS espera_minutos integer;

COMMENT ON COLUMN public.hub_agente_followup_passo.espera_minutos IS
  'Passo 1: minutos sem resposta do cliente. Passos 2+: minutos após o passo anterior enviado.';

-- Backfill: passo 1 = gatilho global + atraso do passo; demais = só atraso do passo.
UPDATE public.hub_agente_followup_passo p
SET espera_minutos = GREATEST(
  1,
  CASE
    WHEN p.ordem = 1 THEN
      COALESCE(c.gatilho_dias, 0) * 1440
      + COALESCE(c.gatilho_horas, 0) * 60
      + COALESCE(c.gatilho_minutos, 0)
      + COALESCE(p.atraso_dias, 0) * 1440
      + COALESCE(p.atraso_horas, 0) * 60
      + COALESCE(p.atraso_minutos, 0)
    ELSE
      COALESCE(p.atraso_dias, 0) * 1440
      + COALESCE(p.atraso_horas, 0) * 60
      + COALESCE(p.atraso_minutos, 0)
  END
)
FROM public.hub_agente_followup_config c
WHERE c.id = p.config_id
  AND p.espera_minutos IS NULL;

-- Zera gatilho global (timing passa a viver só nos passos via espera_minutos).
UPDATE public.hub_agente_followup_config
SET
  gatilho_dias = 0,
  gatilho_horas = 0,
  gatilho_minutos = 0,
  gatilho_tipo = 'silencio'
WHERE gatilho_dias IS NOT NULL
   OR gatilho_horas IS NOT NULL
   OR gatilho_minutos IS NOT NULL;

ALTER TABLE public.hub_agente_followup_passo
  DROP CONSTRAINT IF EXISTS hub_agente_followup_passo_espera_minutos_check;

ALTER TABLE public.hub_agente_followup_passo
  ADD CONSTRAINT hub_agente_followup_passo_espera_minutos_check
  CHECK (espera_minutos IS NULL OR (espera_minutos >= 1 AND espera_minutos <= 525600));
