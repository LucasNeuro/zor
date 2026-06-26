-- Permite todos os passos da cadência no mesmo dia (ex.: passo 1 + passo 2 em testes 3+4 min).
ALTER TABLE public.hub_agente_followup_config
  ALTER COLUMN max_envios_por_dia SET DEFAULT 10;

UPDATE public.hub_agente_followup_config
SET max_envios_por_dia = GREATEST(max_envios_por_dia, 10)
WHERE max_envios_por_dia < 2;
