-- Colunas do wizard Waje em hub_agente_identidade (bases criadas só com obra10_runtime_essencial).
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS area TEXT DEFAULT 'geral';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS nivel INTEGER DEFAULT 3;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS personalidade TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS tom_voz TEXT DEFAULT 'profissional e cordial';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS estilo_comunicacao TEXT DEFAULT 'Direto';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS prefixo_mercado TEXT DEFAULT 'GRL';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS pode_fazer JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS nao_pode_fazer JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS sempre_dizer JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS nunca_dizer JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS horario_inicio TEXT DEFAULT '08:00:00';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS horario_fim TEXT DEFAULT '22:00:00';
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS dias_semana JSONB DEFAULT '["seg","ter","qua","qui","sex"]'::jsonb;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS modelo_critico TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS modelo_alto_valor TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.hub_agente_identidade ADD COLUMN IF NOT EXISTS instrucao_modo TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.bio IS 'Resumo curto do agente (wizard / ficha CRM).';
COMMENT ON COLUMN public.hub_agente_identidade.personalidade IS 'Markdown dos eixos de personalidade (wizard).';
