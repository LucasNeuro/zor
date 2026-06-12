-- Gmail OAuth por tenant + ligação agente canal_email (Zendesk-like).

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS email_integracao_id UUID REFERENCES public.hub_integracoes (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.hub_agente_identidade.email_provider IS
  'resend = envio/inbound Resend global; oauth_google = mailbox Gmail OAuth do tenant (hub_integracoes gmail).';
COMMENT ON COLUMN public.hub_agente_identidade.email_integracao_id IS
  'FK hub_integracoes quando email_provider = oauth_google.';

ALTER TABLE public.hub_agente_identidade
  DROP CONSTRAINT IF EXISTS hub_agente_identidade_email_provider_check;

ALTER TABLE public.hub_agente_identidade
  ADD CONSTRAINT hub_agente_identidade_email_provider_check
  CHECK (email_provider IS NULL OR email_provider IN ('resend', 'oauth_google'));

CREATE INDEX IF NOT EXISTS idx_hub_agente_email_integracao
  ON public.hub_agente_identidade (email_integracao_id)
  WHERE email_integracao_id IS NOT NULL;

-- Credenciais OAuth2 (tokens encriptados na app via HUB_CREDENTIALS_ENCRYPTION_KEY).
ALTER TABLE public.hub_integracao_credenciais
  DROP CONSTRAINT IF EXISTS hub_integracao_credenciais_tipo_auth_check;

ALTER TABLE public.hub_integracao_credenciais
  ADD CONSTRAINT hub_integracao_credenciais_tipo_auth_check
  CHECK (tipo_auth IN ('api_key', 'bearer', 'oauth_placeholder', 'oauth2'));
