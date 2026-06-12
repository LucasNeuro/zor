-- Canal e-mail: conversas separadas + campos em hub_mensagens

ALTER TABLE public.hub_leads_crm DROP CONSTRAINT IF EXISTS hub_leads_crm_origem_check;
ALTER TABLE public.hub_leads_crm
  ADD CONSTRAINT hub_leads_crm_origem_check
  CHECK (
    origem IS NULL
    OR origem IN (
      'whatsapp', 'instagram', 'meta_ads', 'google_ads', 'linkedin',
      'site', 'indicacao', 'email', 'outro'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_conversas_lead_canal_ativa
  ON public.hub_conversas (lead_id, canal)
  WHERE encerrada_em IS NULL;

ALTER TABLE public.hub_mensagens
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_in_reply_to text,
  ADD COLUMN IF NOT EXISTS email_status text;

ALTER TABLE public.hub_fila_mensagens
  ALTER COLUMN remetente_numero DROP NOT NULL;

ALTER TABLE public.hub_fila_mensagens
  ADD COLUMN IF NOT EXISTS remetente_email text;
