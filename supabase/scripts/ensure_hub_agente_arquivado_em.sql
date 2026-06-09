-- Arquivamento de agentes: colar no Supabase → SQL Editor → Run
-- Ficheiro espelho: supabase/migrations/20260621180000_ensure_hub_agente_arquivado_em.sql

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

CREATE INDEX IF NOT EXISTS hub_agente_identidade_arquivado_em_idx
  ON public.hub_agente_identidade (arquivado_em)
  WHERE arquivado_em IS NOT NULL;
