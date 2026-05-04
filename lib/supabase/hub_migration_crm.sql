-- CRM Pipeline Migration — hub_migration_crm.sql
-- Tables: hub_leads_crm, hub_atividades, hub_notas, hub_servicos, hub_propostas,
--         hub_agente_conhecimento, hub_memorias_lead

CREATE TABLE IF NOT EXISTS hub_leads_crm (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  origem TEXT CHECK (origem IN ('whatsapp','instagram','meta_ads','google_ads','linkedin','site','indicacao','outro')),
  campanha TEXT,
  anuncio_id TEXT,
  estagio TEXT DEFAULT 'novo' CHECK (estagio IN ('novo','qualificando','qualificado','proposta','negociando','fechamento','ganho','perdido')),
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  valor_estimado NUMERIC(12,2) DEFAULT 0,
  agente_responsavel TEXT,
  humano_responsavel TEXT,
  proxima_acao TEXT,
  data_proxima_acao TIMESTAMPTZ,
  motivo_perda TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_atividades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES hub_leads_crm(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('mensagem','ligacao','email','reuniao','nota','proposta','follow_up','status_change','ia_acao')),
  descricao TEXT NOT NULL,
  feito_por TEXT NOT NULL,
  feito_por_tipo TEXT DEFAULT 'humano' CHECK (feito_por_tipo IN ('humano','ia')),
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_notas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES hub_leads_crm(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT CHECK (categoria IN ('marketing','trafego','conteudo','sites','crm','consultoria','outro')),
  faixa_preco_min NUMERIC(12,2),
  faixa_preco_max NUMERIC(12,2),
  publico_alvo TEXT,
  entregaveis TEXT,
  prazo_medio_dias INTEGER,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_servicos_nome ON hub_servicos(nome);

CREATE TABLE IF NOT EXISTS hub_propostas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES hub_leads_crm(id) ON DELETE CASCADE,
  servico_id UUID REFERENCES hub_servicos(id),
  titulo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  escopo TEXT,
  prazo_dias INTEGER,
  validade_dias INTEGER DEFAULT 7,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando_aprovacao','aprovada','enviada','aceita','recusada','expirada')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  enviada_em TIMESTAMPTZ,
  respondida_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_agente_conhecimento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug TEXT NOT NULL,
  secao TEXT NOT NULL CHECK (secao IN ('empresa','servicos','atendimento','proibicoes','exemplos','objeccoes')),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_memorias_lead (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES hub_leads_crm(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  confianca NUMERIC(3,2) DEFAULT 1.0,
  criado_por TEXT DEFAULT 'ia',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_estagio ON hub_leads_crm(estagio);
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_origem ON hub_leads_crm(origem);
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_agente ON hub_leads_crm(agente_responsavel);
CREATE INDEX IF NOT EXISTS idx_hub_atividades_lead ON hub_atividades(lead_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_notas_lead ON hub_notas(lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_propostas_lead ON hub_propostas(lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_conhecimento_agente ON hub_agente_conhecimento(agente_slug, secao);
CREATE INDEX IF NOT EXISTS idx_hub_memorias_lead ON hub_memorias_lead(lead_id);

-- TRIGGERS (idempotent)
DROP TRIGGER IF EXISTS hub_leads_crm_ts ON hub_leads_crm;
DROP TRIGGER IF EXISTS hub_notas_ts ON hub_notas;
DROP TRIGGER IF EXISTS hub_servicos_ts ON hub_servicos;
DROP TRIGGER IF EXISTS hub_propostas_ts ON hub_propostas;
DROP TRIGGER IF EXISTS hub_conhecimento_ts ON hub_agente_conhecimento;

CREATE TRIGGER hub_leads_crm_ts BEFORE UPDATE ON hub_leads_crm FOR EACH ROW EXECUTE FUNCTION hub_atualizar_timestamp();
CREATE TRIGGER hub_notas_ts BEFORE UPDATE ON hub_notas FOR EACH ROW EXECUTE FUNCTION hub_atualizar_timestamp();
CREATE TRIGGER hub_servicos_ts BEFORE UPDATE ON hub_servicos FOR EACH ROW EXECUTE FUNCTION hub_atualizar_timestamp();
CREATE TRIGGER hub_propostas_ts BEFORE UPDATE ON hub_propostas FOR EACH ROW EXECUTE FUNCTION hub_atualizar_timestamp();
CREATE TRIGGER hub_conhecimento_ts BEFORE UPDATE ON hub_agente_conhecimento FOR EACH ROW EXECUTE FUNCTION hub_atualizar_timestamp();

-- RLS
ALTER TABLE hub_leads_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_agente_conhecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_memorias_lead ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_leads_crm;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_atividades;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_notas;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_servicos;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_propostas;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_agente_conhecimento;
DROP POLICY IF EXISTS "hub_acesso_total" ON hub_memorias_lead;

CREATE POLICY "hub_acesso_total" ON hub_leads_crm FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_atividades FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_notas FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_servicos FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_propostas FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_agente_conhecimento FOR ALL USING (true);
CREATE POLICY "hub_acesso_total" ON hub_memorias_lead FOR ALL USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE hub_leads_crm;
ALTER PUBLICATION supabase_realtime ADD TABLE hub_atividades;
ALTER PUBLICATION supabase_realtime ADD TABLE hub_propostas;

-- SEED SERVICES
INSERT INTO hub_servicos (nome, descricao, categoria, faixa_preco_min, faixa_preco_max, publico_alvo, entregaveis, prazo_medio_dias) VALUES
('Gestão de Tráfego Meta Ads', 'Criação e gestão de campanhas no Facebook e Instagram Ads', 'trafego', 1500, 5000, 'Empresas que querem leads via Meta', 'Campanhas configuradas, relatório semanal, otimização contínua', 30),
('Gestão de Tráfego Google Ads', 'Criação e gestão de campanhas no Google Search e Display', 'trafego', 1500, 5000, 'Empresas que querem leads via Google', 'Campanhas configuradas, relatório semanal, otimização contínua', 30),
('Gestão de Tráfego Completa', 'Meta Ads + Google Ads + relatórios integrados', 'trafego', 3000, 8000, 'Empresas que querem escala', 'Todas as plataformas, dashboard unificado', 30),
('Landing Page', 'Criação de página de captura otimizada para conversão', 'sites', 1500, 4000, 'Empresas que precisam converter tráfego', 'Página publicada, pixel instalado, formulário integrado', 15),
('Site Institucional', 'Site completo com páginas institucionais', 'sites', 3000, 8000, 'Empresas sem presença digital', 'Site publicado, responsivo, com SEO básico', 30),
('Produção de Conteúdo', 'Posts, legendas, stories e reels para redes sociais', 'conteudo', 800, 2500, 'Empresas que precisam de presença nas redes', '20 posts/mês, artes e legendas', 30),
('Consultoria de Marketing', 'Diagnóstico e plano estratégico de marketing digital', 'consultoria', 2000, 5000, 'Empresas que precisam de direção', 'Relatório diagnóstico + plano de ação 90 dias', 15),
('CRM e Automação', 'Configuração de CRM e fluxos de automação de atendimento', 'crm', 2000, 6000, 'Empresas com volume de leads', 'CRM configurado, fluxos ativos, treinamento da equipe', 20)
ON CONFLICT (nome) DO NOTHING;
