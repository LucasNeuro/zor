-- Ledger de envios + faixa horária flexível por agente (Fase 1 follow-up).

CREATE TABLE IF NOT EXISTS public.hub_followup_envio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  passo_id UUID NOT NULL REFERENCES public.hub_agente_followup_passo(id) ON DELETE CASCADE,
  agente_slug TEXT NOT NULL,
  passo_ordem INT NOT NULL,
  tenant_id UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hub_followup_envio_lead_passo_unique UNIQUE (lead_id, passo_id)
);

CREATE INDEX IF NOT EXISTS hub_followup_envio_lead_id_idx ON public.hub_followup_envio (lead_id);
CREATE INDEX IF NOT EXISTS hub_followup_envio_agente_slug_idx ON public.hub_followup_envio (agente_slug);
CREATE INDEX IF NOT EXISTS hub_followup_envio_enviado_em_idx ON public.hub_followup_envio (enviado_em DESC);

COMMENT ON TABLE public.hub_followup_envio IS
  'Ledger de passos de follow-up já enviados — UNIQUE(lead_id, passo_id) impede reenvio do mesmo passo.';

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS horario_inicio TEXT NOT NULL DEFAULT '08:00';

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS horario_fim TEXT NOT NULL DEFAULT '22:00';

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS janela_modo TEXT NOT NULL DEFAULT 'faixa';

ALTER TABLE public.hub_agente_followup_config
  DROP CONSTRAINT IF EXISTS hub_agente_followup_config_janela_modo_check;

ALTER TABLE public.hub_agente_followup_config
  ADD CONSTRAINT hub_agente_followup_config_janela_modo_check
  CHECK (janela_modo IN ('faixa', 'slots', 'continuo'));

ALTER TABLE public.hub_agente_followup_config
  ADD COLUMN IF NOT EXISTS max_envios_por_dia INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.hub_agente_followup_config.janela_modo IS
  'faixa = horario_inicio–horario_fim; slots = horarios_disparo; continuo = 24/7.';
COMMENT ON COLUMN public.hub_agente_followup_config.max_envios_por_dia IS
  'Máximo de passos automáticos por lead por dia (contagem via ledger).';

-- Legado: janela_horaria com slots → janela_modo slots; continuo mantém continuo.
UPDATE public.hub_agente_followup_config
SET janela_modo = 'continuo'
WHERE execucao_modo = 'continuo' AND janela_modo = 'faixa';

UPDATE public.hub_agente_followup_config
SET janela_modo = 'slots'
WHERE execucao_modo = 'janela_horaria' AND janela_modo = 'faixa';

-- Backfill ledger a partir da fila CRM (follow-up automático já enviado).
INSERT INTO public.hub_followup_envio (lead_id, passo_id, agente_slug, passo_ordem, tenant_id, enviado_em)
SELECT DISTINCT ON (fm.lead_id, (fm.metadata->>'passo_id')::uuid)
  fm.lead_id,
  (fm.metadata->>'passo_id')::uuid,
  COALESCE(fm.agente_id, fm.metadata->>'agente_slug', ''),
  COALESCE(
    NULLIF((fm.metadata->>'passo_ordem')::int, 0),
    NULLIF((fm.metadata->>'passo')::int, 0),
    1
  ),
  fm.tenant_id,
  fm.criado_em
FROM public.hub_fila_mensagens fm
WHERE fm.metadata->>'tipo' = 'followup_automatico'
  AND (fm.metadata->>'passo_id') ~ '^[0-9a-f-]{36}$'
  AND fm.lead_id IS NOT NULL
ORDER BY fm.lead_id, (fm.metadata->>'passo_id')::uuid, fm.criado_em ASC
ON CONFLICT (lead_id, passo_id) DO NOTHING;
