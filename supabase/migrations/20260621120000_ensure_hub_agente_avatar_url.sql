-- Garante avatar_url em hub_agente_identidade (bases sem 20260511120000 ou schema cache desatualizado).
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.avatar_url IS
  'URL ou data-URI do avatar do agente (gerado no wizard ou enviado pelo CRM).';
