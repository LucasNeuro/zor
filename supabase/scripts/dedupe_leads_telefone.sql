-- Remove leads duplicados por telefone (mantém o mais recente por ultimo_contato).
-- Executar manualmente no SQL Editor antes da migração hub_leads_crm_telefone_unique.

WITH ranked AS (
  SELECT
    id,
    telefone,
    tenant_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, regexp_replace(telefone, '\D', '', 'g')
      ORDER BY ultimo_contato DESC NULLS LAST, atualizado_em DESC NULLS LAST, criado_em DESC
    ) AS rn
  FROM public.hub_leads_crm
  WHERE telefone IS NOT NULL AND length(trim(telefone)) >= 10
)
DELETE FROM public.hub_leads_crm
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
