-- Colunas usadas pela Central de Atendimento (API send + leads).
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultimo_contato TIMESTAMPTZ;

ALTER TABLE public.hub_fila_mensagens ADD COLUMN IF NOT EXISTS enviada_em TIMESTAMPTZ;
ALTER TABLE public.hub_fila_mensagens ADD COLUMN IF NOT EXISTS resposta_enviada BOOLEAN DEFAULT FALSE;
