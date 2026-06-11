-- Formulário de interesse da landing (mini-bot Waje).
-- Tabela isolada: sem FK para leads, tenants ou CRM. Acesso só via service role (API).

CREATE TABLE IF NOT EXISTS public.waje_landing_interesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  empresa text,
  mensagem text,
  interesse_principal text,
  tamanho_equipe text,
  prazo_inicio text,
  respostas jsonb NOT NULL DEFAULT '[]'::jsonb,
  origem text NOT NULL DEFAULT 'landing_mini_bot',
  pagina_url text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_waje_landing_interesse_criado_em
  ON public.waje_landing_interesse (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_waje_landing_interesse_email
  ON public.waje_landing_interesse (lower(email));

COMMENT ON TABLE public.waje_landing_interesse IS
  'Interesse captado pelo mini-bot da landing Waje. Não vincula a hub_leads_crm nem tenants — uso interno dos donos da plataforma.';

COMMENT ON COLUMN public.waje_landing_interesse.respostas IS
  'Histórico Q&A do mini-bot: [{ "pergunta": "...", "resposta": "..." }, …].';

-- Bloqueia acesso direto anon/authenticated; APIs usam SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.waje_landing_interesse ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.waje_landing_interesse FROM anon, authenticated;
