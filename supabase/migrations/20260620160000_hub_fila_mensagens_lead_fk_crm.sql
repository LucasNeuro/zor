-- hub_fila_mensagens.lead_id deve apontar para hub_leads_crm (WhatsApp / CRM operacional).
ALTER TABLE public.hub_fila_mensagens
  DROP CONSTRAINT IF EXISTS hub_fila_mensagens_lead_id_fkey;

DO $$
BEGIN
  IF to_regclass('public.hub_leads_crm') IS NOT NULL THEN
    ALTER TABLE public.hub_fila_mensagens
      ADD CONSTRAINT hub_fila_mensagens_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hub_fila_mensagens_lead_fk_crm: %', SQLERRM;
END $$;

COMMENT ON CONSTRAINT hub_fila_mensagens_lead_id_fkey ON public.hub_fila_mensagens IS
  'Lead CRM WhatsApp (hub_leads_crm.id).';
