-- Backfill: ultima_msg_cliente_em a partir da última mensagem inbound na fila (leads legados).

UPDATE public.hub_leads_crm AS l
SET ultima_msg_cliente_em = sub.ultima_inbound
FROM (
  SELECT
    f.lead_id,
    MAX(COALESCE(f.enviada_em, f.criado_em)) AS ultima_inbound
  FROM public.hub_fila_mensagens AS f
  WHERE f.direcao = 'entrada'
    AND f.lead_id IS NOT NULL
  GROUP BY f.lead_id
) AS sub
WHERE l.id = sub.lead_id
  AND l.ultima_msg_cliente_em IS NULL;

COMMENT ON COLUMN public.hub_leads_crm.ultima_msg_cliente_em IS
  'Última mensagem recebida do cliente (WhatsApp). Relógio exclusivo do follow-up — respostas do bot não alteram.';
