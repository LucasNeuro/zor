-- Dedupe de mensagens Gmail processadas pelo cron email-sync.

CREATE TABLE IF NOT EXISTS public.hub_email_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  integracao_id uuid NOT NULL REFERENCES public.hub_integracoes (id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  rfc_message_id text,
  agente_slug text,
  lead_id uuid REFERENCES public.hub_leads_crm (id) ON DELETE SET NULL,
  processado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_email_sync_state_integracao_gmail_msg_unique UNIQUE (integracao_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_email_sync_state_tenant
  ON public.hub_email_sync_state (tenant_id, processado_em DESC);

COMMENT ON TABLE public.hub_email_sync_state IS
  'Mensagens Gmail já processadas pelo cron /api/cron/email-sync.';
