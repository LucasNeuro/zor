-- Pipeline de atendimento: estágio separado do funil comercial (estagio / estagio_funil).

ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS estagio_atendimento TEXT DEFAULT 'novo';

COMMENT ON COLUMN public.hub_leads_crm.estagio_atendimento IS
  'Estágio no funil de atendimento (novo, em_andamento, aguardando, fechado).';

ALTER TABLE public.hub_pipelines DROP CONSTRAINT IF EXISTS hub_pipelines_tipo_check;
ALTER TABLE public.hub_pipelines
  ADD CONSTRAINT hub_pipelines_tipo_check CHECK (tipo IN ('lead', 'negocio', 'atendimento'));

-- Leads com conversa ou responsável entram no funil de atendimento como "novo".
UPDATE public.hub_leads_crm l
SET estagio_atendimento = 'novo'
WHERE (estagio_atendimento IS NULL OR TRIM(estagio_atendimento) = '')
  AND (
    EXISTS (SELECT 1 FROM public.hub_fila_mensagens f WHERE f.lead_id = l.id)
    OR (l.humano_responsavel IS NOT NULL AND TRIM(l.humano_responsavel) <> '')
    OR (l.agente_responsavel IS NOT NULL AND TRIM(l.agente_responsavel) <> '')
  );

-- vw_hub_leads_crm_enriquecido usa l.* — coluna exposta automaticamente após ADD COLUMN.
