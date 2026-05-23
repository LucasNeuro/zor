-- Arquivamento soft de agentes (CRM / Hub).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.arquivado_em IS
  'Preenchido quando o agente foi arquivado; oculto de listas operacionais.';
COMMENT ON COLUMN public.hub_agente_identidade.arquivado_motivo IS
  'Motivo registado no arquivamento via CRM (mín. 10 caracteres).';

CREATE INDEX IF NOT EXISTS hub_agente_identidade_arquivado_em_idx
  ON public.hub_agente_identidade (arquivado_em)
  WHERE arquivado_em IS NOT NULL;
