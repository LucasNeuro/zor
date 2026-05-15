-- Modo por sessão: revisão interna (operacional) vs simulação como no canal ao vivo.
ALTER TABLE public.hub_crm_agente_briefing_sessao
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'briefing_interno';

COMMENT ON COLUMN public.hub_crm_agente_briefing_sessao.modo IS
  'briefing_interno = snapshot ciclos/logs; simulacao_canal = prompt builder de produção (teste playbook).';
