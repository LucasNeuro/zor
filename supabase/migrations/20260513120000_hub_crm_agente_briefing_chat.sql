-- Chat de briefing interno (CRM): histórico persistente, isolado do fluxo WhatsApp/leads.
-- Service role nas rotas /api/hub/* usa a mesma política permissiva dos demais hubs internos.

CREATE TABLE IF NOT EXISTS public.hub_crm_agente_briefing_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug text NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON UPDATE CASCADE ON DELETE CASCADE,
  titulo text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_crm_agente_briefing_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.hub_crm_agente_briefing_sessao(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  conteudo text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_briefing_sessao_agente ON public.hub_crm_agente_briefing_sessao(agente_slug, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_briefing_msg_sessao ON public.hub_crm_agente_briefing_mensagem(sessao_id, criado_em);

COMMENT ON TABLE public.hub_crm_agente_briefing_sessao IS 'Sessão de chat briefing interno CRM ↔ agente (não é conversa de lead).';
COMMENT ON TABLE public.hub_crm_agente_briefing_mensagem IS 'Mensagens do briefing; metadata pode guardar tokens/modelo/custo.';

ALTER TABLE public.hub_crm_agente_briefing_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_crm_agente_briefing_mensagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_crm_briefing_sessao_service_all ON public.hub_crm_agente_briefing_sessao;
CREATE POLICY hub_crm_briefing_sessao_service_all ON public.hub_crm_agente_briefing_sessao
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_crm_briefing_msg_service_all ON public.hub_crm_agente_briefing_mensagem;
CREATE POLICY hub_crm_briefing_msg_service_all ON public.hub_crm_agente_briefing_mensagem
  FOR ALL USING (true) WITH CHECK (true);
