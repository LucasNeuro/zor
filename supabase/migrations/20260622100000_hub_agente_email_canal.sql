-- Canal e-mail (Resend) por agente — v1 single-channel (modo_operacao = canal_email).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS email_from TEXT,
  ADD COLUMN IF NOT EXISTS email_from_name TEXT,
  ADD COLUMN IF NOT EXISTS email_inbound TEXT,
  ADD COLUMN IF NOT EXISTS email_ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_configured_at TIMESTAMPTZ;

COMMENT ON COLUMN public.hub_agente_identidade.email_from IS
  'Remetente outbound Resend (domínio verificado).';
COMMENT ON COLUMN public.hub_agente_identidade.email_from_name IS
  'Nome de exibição do remetente (From).';
COMMENT ON COLUMN public.hub_agente_identidade.email_inbound IS
  'Endereço de entrada Resend; correlaciona webhook inbound → agente.';
COMMENT ON COLUMN public.hub_agente_identidade.email_ativo IS
  'Se false, ignora mensagens inbound para este agente.';
COMMENT ON COLUMN public.hub_agente_identidade.email_configured_at IS
  'Timestamp da última configuração do canal e-mail no CRM.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_agente_email_inbound
  ON public.hub_agente_identidade (lower(trim(email_inbound)))
  WHERE email_inbound IS NOT NULL AND trim(email_inbound) <> '';

-- Inclui canal_email no check de modo_operacao (single-channel: whatsapp OU email OU jobs_internos).
ALTER TABLE public.hub_agente_identidade
  DROP CONSTRAINT IF EXISTS hub_agente_identidade_modo_operacao_check;

ALTER TABLE public.hub_agente_identidade
  ADD CONSTRAINT hub_agente_identidade_modo_operacao_check
  CHECK (
    modo_operacao IS NULL
    OR modo_operacao IN ('canal_whatsapp', 'canal_email', 'jobs_internos')
  );

COMMENT ON COLUMN public.hub_agente_identidade.modo_operacao IS
  'canal_whatsapp = atendimento UAZAPI; canal_email = atendimento Resend; jobs_internos = ciclos cron/dispatch.';
