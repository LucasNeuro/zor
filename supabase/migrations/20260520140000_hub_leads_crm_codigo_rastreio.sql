-- Código único de lead (LED-AAAA-####) para rastreio no pipeline comercial.
-- PES- permanece em hub_pessoas (contato); LED identifica a oportunidade no funil.

ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_leads_crm_codigo
  ON public.hub_leads_crm (codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON COLUMN public.hub_leads_crm.codigo IS
  'Código de rastreio do lead (ex.: LED-2026-0017). Distinto do código PES da pessoa vinculada.';

-- Backfill para registos antigos (ordem de criação).
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY criado_em NULLS LAST, id) AS rn
  FROM public.hub_leads_crm
  WHERE codigo IS NULL OR TRIM(codigo) = ''
)
UPDATE public.hub_leads_crm l
SET codigo = 'LED-' || TO_CHAR(EXTRACT(YEAR FROM COALESCE(l.criado_em, NOW())), 'FM9999') || '-' || LPAD(n.rn::TEXT, 4, '0')
FROM numbered n
WHERE l.id = n.id;

DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;

CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''::text), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

COMMENT ON VIEW public.vw_hub_leads_crm_enriquecido IS
  'hub_leads_crm.* + pessoa_codigo (PES), email_exibicao, última mensagem da fila. l.codigo = LED do lead.';
