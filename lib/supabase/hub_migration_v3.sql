-- ============================================================
-- HUB MIGRATION V3 — Tabelas completas do organismo
-- ============================================================

-- APROVAÇÕES — fila de aprovações para o humano
CREATE TABLE IF NOT EXISTS hub_aprovacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL,
  agente_slug TEXT NOT NULL,
  agente_nome TEXT,
  descricao TEXT NOT NULL,
  motivo TEXT,
  impacto TEXT,
  recomendacao TEXT,
  confianca_ia NUMERIC(5,2) DEFAULT 85,
  lead_id UUID,
  cliente_id UUID,
  valor_envolvido NUMERIC(12,2) DEFAULT 0,
  prazo TIMESTAMPTZ,
  dados JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  rejeitado_por TEXT,
  rejeitado_em TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ARQUIVOS DE MÍDIA — imagens, vídeos, áudios, documentos
CREATE TABLE IF NOT EXISTS hub_arquivos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('imagem','video','audio','documento','criativo','proposta','contrato','relatorio')),
  origem TEXT NOT NULL CHECK (origem IN ('marketing','comercial','atendimento','trafego','conteudo','cliente','ia_gerado')),
  bucket TEXT NOT NULL,
  caminho TEXT NOT NULL,
  url TEXT NOT NULL,
  tamanho INTEGER DEFAULT 0,
  formato TEXT,
  lead_id UUID,
  cliente_id UUID,
  agente_slug TEXT,
  campanha_id TEXT,
  versao INTEGER DEFAULT 1,
  aprovado BOOLEAN DEFAULT false,
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSAS LOG — registro completo de conversas
CREATE TABLE IF NOT EXISTS hub_conversas_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  canal TEXT NOT NULL,
  agente_slug TEXT,
  total_mensagens INTEGER DEFAULT 0,
  url_arquivo TEXT,
  duracao_segundos INTEGER DEFAULT 0,
  converteu BOOLEAN DEFAULT false,
  nps INTEGER,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- MÉTRICAS DE TRÁFEGO — CPL, ROAS, CTR por campanha
CREATE TABLE IF NOT EXISTS hub_metricas_trafego (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campanha_id TEXT NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('meta','google','linkedin','tiktok')),
  cpl NUMERIC(10,2) DEFAULT 0,
  cpl_meta NUMERIC(10,2) DEFAULT 60,
  roas NUMERIC(10,4) DEFAULT 0,
  ctr NUMERIC(5,4) DEFAULT 0,
  cpa NUMERIC(10,2) DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  verba_consumida NUMERIC(10,2) DEFAULT 0,
  verba_diaria_meta NUMERIC(10,2) DEFAULT 1000,
  conjunto_id TEXT,
  criativo_id TEXT,
  status_campanha TEXT DEFAULT 'ativa',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- PERSONALIDADE DOS AGENTES — matriz 5x5
CREATE TABLE IF NOT EXISTS hub_personalidade (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug TEXT NOT NULL UNIQUE,
  humor INTEGER DEFAULT 2 CHECK (humor BETWEEN 1 AND 5),
  personalidade INTEGER DEFAULT 2 CHECK (personalidade BETWEEN 1 AND 5),
  humor_label TEXT,
  personalidade_label TEXT,
  combinacao_label TEXT,
  descricao_comportamento TEXT,
  tom_comunicacao TEXT,
  exemplos_resposta JSONB DEFAULT '[]',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- BRIEFINGS — projetos, conteúdo e campanhas
CREATE TABLE IF NOT EXISTS hub_briefings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL CHECK (tipo IN ('campanha','conteudo','site','proposta','estrategia')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  agente_solicitante TEXT,
  agente_responsavel TEXT,
  cliente_id UUID,
  lead_id UUID,
  objetivo TEXT,
  publico_alvo TEXT,
  prazo TIMESTAMPTZ,
  orcamento NUMERIC(10,2),
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','revisao','aprovado','concluido','cancelado')),
  arquivos JSONB DEFAULT '[]',
  dados JSONB DEFAULT '{}',
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- QUALIDADE DOS AGENTES — métricas de performance
CREATE TABLE IF NOT EXISTS hub_qualidade_agente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug TEXT NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  total_tarefas INTEGER DEFAULT 0,
  aprovadas_primeira INTEGER DEFAULT 0,
  retrabalho INTEGER DEFAULT 0,
  taxa_aprovacao NUMERIC(5,2) DEFAULT 0,
  taxa_retrabalho NUMERIC(5,2) DEFAULT 0,
  custo_tokens NUMERIC(10,4) DEFAULT 0,
  latencia_media INTEGER DEFAULT 0,
  nps_medio NUMERIC(3,1),
  alertas_gerados INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agente_slug, data)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_status ON hub_aprovacoes(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_agente ON hub_aprovacoes(agente_slug);
CREATE INDEX IF NOT EXISTS idx_hub_arquivos_lead ON hub_arquivos(lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_arquivos_tipo ON hub_arquivos(tipo, origem);
CREATE INDEX IF NOT EXISTS idx_hub_conversas_lead ON hub_conversas_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_metricas_campanha ON hub_metricas_trafego(campanha_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_qualidade_agente ON hub_qualidade_agente(agente_slug, data DESC);
CREATE INDEX IF NOT EXISTS idx_hub_briefings_status ON hub_briefings(status, tipo);

-- TRIGGERS (usa set_atualizado_em que existe no banco)
CREATE TRIGGER hub_aprovacoes_ts BEFORE UPDATE ON hub_aprovacoes FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER hub_arquivos_ts BEFORE UPDATE ON hub_arquivos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER hub_personalidade_ts BEFORE UPDATE ON hub_personalidade FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER hub_briefings_ts BEFORE UPDATE ON hub_briefings FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- RLS
ALTER TABLE hub_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_conversas_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_metricas_trafego ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_personalidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_qualidade_agente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_aprovacoes_acesso" ON hub_aprovacoes FOR ALL USING (true);
CREATE POLICY "hub_arquivos_acesso" ON hub_arquivos FOR ALL USING (true);
CREATE POLICY "hub_conversas_log_acesso" ON hub_conversas_log FOR ALL USING (true);
CREATE POLICY "hub_metricas_trafego_acesso" ON hub_metricas_trafego FOR ALL USING (true);
CREATE POLICY "hub_personalidade_acesso" ON hub_personalidade FOR ALL USING (true);
CREATE POLICY "hub_briefings_acesso" ON hub_briefings FOR ALL USING (true);
CREATE POLICY "hub_qualidade_agente_acesso" ON hub_qualidade_agente FOR ALL USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE hub_aprovacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE hub_metricas_trafego;

-- SEED PERSONALIDADE — matriz 5x5 para os 5 agentes
INSERT INTO hub_personalidade (agente_slug, humor, personalidade, humor_label, personalidade_label, combinacao_label, descricao_comportamento, tom_comunicacao) VALUES
('atendente', 2, 2, 'Empático', 'Profissional', 'Acolhedor Profissional', 'Atende com empatia e profissionalismo. Ouve antes de falar. Resolve sem prometer o que não pode.', 'caloroso e direto'),
('sdr', 1, 2, 'Focado', 'Profissional', 'Executor Profissional', 'Qualifica rapidamente. Faz as perguntas certas. Não perde tempo com leads inválidos.', 'objetivo e confiante'),
('gerente_atendimento', 3, 1, 'Analítico', 'Formal', 'Analista Formal', 'Supervisiona com dados. Cobra resultados. Toma decisões baseadas em métricas.', 'formal e preciso'),
('ariane', 4, 2, 'Criativo', 'Profissional', 'Criativo Estratégico', 'Pensa fora da caixa. Propõe alternativas. Dirige com visão de negócio.', 'inspirador e estratégico'),
('ceo', 3, 1, 'Analítico', 'Formal', 'Estrategista Executivo', 'Visão macro. Decide com dados. Foco em resultado e crescimento sustentável.', 'executivo e estratégico')
ON CONFLICT (agente_slug) DO NOTHING;
