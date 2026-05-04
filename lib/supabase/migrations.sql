-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PESSOAS (âncora central — nunca deletar)
CREATE TABLE IF NOT EXISTS pessoas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  whatsapp_id TEXT,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  tipo TEXT NOT NULL DEFAULT 'lead'
    CHECK (tipo IN ('lead','cliente','parceiro','fornecedor','interno')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAMPANHAS
CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  canal TEXT NOT NULL
    CHECK (canal IN ('meta_ads','google_ads','organico','indicacao')),
  status TEXT DEFAULT 'ativa'
    CHECK (status IN ('ativa','pausada','encerrada')),
  budget_diario NUMERIC DEFAULT 0,
  gasto_hoje NUMERIC DEFAULT 0,
  leads_gerados INTEGER DEFAULT 0,
  cpl_atual NUMERIC DEFAULT 0,
  roas_atual NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero SERIAL UNIQUE NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  campanha_id UUID REFERENCES campanhas(id),
  canal TEXT NOT NULL
    CHECK (canal IN ('meta_ads','google_ads','organico','indicacao','whatsapp')),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('mercado_imobiliario','reforma','produto_servico','fornecedor_homologacao')),
  status TEXT DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','triagem','qualificando','qualificado','match','perdido','frio')),
  fase_canvas TEXT DEFAULT 'entrando',
  sala_atual TEXT DEFAULT 'main_entrance',
  valor_estimado NUMERIC DEFAULT 0,
  score_prioridade INTEGER DEFAULT 50,
  sla_target_min INTEGER DEFAULT 5,
  tempo_aguardando_min INTEGER DEFAULT 0,
  agente_responsavel_id TEXT,
  ia_status TEXT DEFAULT 'ativa'
    CHECK (ia_status IN ('ativa','pausada','copiloto','bloqueada')),
  ultima_mensagem TEXT,
  ultima_mensagem_de TEXT,
  ultima_mensagem_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEGÓCIOS (código imutável após criação)
CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  codigo_display TEXT UNIQUE NOT NULL,
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  campanha_id UUID REFERENCES campanhas(id),
  mercado TEXT NOT NULL
    CHECK (mercado IN ('IMB','ARQ','RFM','MRC','ENG','SRV','PRO','FOR')),
  status TEXT DEFAULT 'triagem'
    CHECK (status IN ('triagem','qualificacao','match','negociacao','ganho','perdido','pos_venda')),
  valor_estimado NUMERIC DEFAULT 0,
  valor_fechado NUMERIC,
  responsavel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION proteger_codigo_negocio()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.codigo != NEW.codigo THEN
    RAISE EXCEPTION 'Código do negócio é imutável após criação';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER negocio_codigo_imutavel
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION proteger_codigo_negocio();

-- OPORTUNIDADES
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  negocio_id UUID NOT NULL REFERENCES negocios(id),
  tipo TEXT NOT NULL
    CHECK (tipo IN ('IMB','ARQ','RFM','MRC','ENG','SRV','PRO','FOR')),
  status TEXT DEFAULT 'identificada'
    CHECK (status IN ('identificada','em_andamento','ganha','perdida')),
  valor_estimado NUMERIC,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARCEIROS
CREATE TABLE IF NOT EXISTS parceiros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  categoria TEXT NOT NULL
    CHECK (categoria IN ('arquitetura','engenharia','marcenaria','servicos','produtos')),
  especialidade TEXT NOT NULL,
  regiao TEXT NOT NULL,
  status TEXT DEFAULT 'em_homologacao'
    CHECK (status IN ('ativo','ocupado','pausado','em_homologacao','inativo')),
  capacidade_semanal INTEGER DEFAULT 2,
  taxa_aceite NUMERIC DEFAULT 0,
  taxa_fechamento NUMERIC DEFAULT 0,
  nps NUMERIC DEFAULT 0,
  transparency_score NUMERIC DEFAULT 0,
  fit_score NUMERIC DEFAULT 0,
  homologacao_etapa TEXT DEFAULT 'cadastro',
  homologacao_pct INTEGER DEFAULT 0,
  comissao_gerada NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSAS
CREATE TABLE IF NOT EXISTS conversas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  canal TEXT DEFAULT 'whatsapp'
    CHECK (canal IN ('whatsapp','instagram','web','interno')),
  whatsapp_chat_id TEXT,
  status TEXT DEFAULT 'aberta'
    CHECK (status IN ('aberta','em_atendimento_ia','em_atendimento_humano','aguardando','encerrada','reativada')),
  ia_status TEXT DEFAULT 'ativa'
    CHECK (ia_status IN ('ativa','pausada','copiloto','bloqueada')),
  agente_ia_id TEXT,
  humano_responsavel_id TEXT,
  total_mensagens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MENSAGENS
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id UUID NOT NULL REFERENCES conversas(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  de TEXT NOT NULL
    CHECK (de IN ('lead','agente_ia','humano','sistema')),
  agente_id TEXT,
  texto TEXT,
  audio_url TEXT,
  audio_transcricao TEXT,
  imagem_url TEXT,
  documento_url TEXT,
  whatsapp_message_id TEXT,
  canal TEXT DEFAULT 'interno'
    CHECK (canal IN ('whatsapp','interno')),
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AGENTES
CREATE TABLE IF NOT EXISTS agentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  area TEXT NOT NULL,
  sala_id TEXT NOT NULL,
  nivel_hierarquico INTEGER NOT NULL,
  humor TEXT NOT NULL,
  personalidade TEXT NOT NULL,
  status TEXT DEFAULT 'online'
    CHECK (status IN ('online','offline','reuniao','alerta')),
  current_activity TEXT,
  ia_modelo TEXT DEFAULT 'claude-sonnet-4-6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DECISÕES
CREATE TABLE IF NOT EXISTS decisoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL
    CHECK (status IN ('critical','warning','info','system')),
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  area TEXT NOT NULL,
  impacto_financeiro NUMERIC DEFAULT 0,
  prioridade INTEGER DEFAULT 50,
  lead_id UUID REFERENCES leads(id),
  parceiro_id UUID REFERENCES parceiros(id),
  campanha_id UUID REFERENCES campanhas(id),
  agente_id TEXT,
  recomendacao TEXT NOT NULL,
  confianca TEXT DEFAULT 'media'
    CHECK (confianca IN ('alta','media','baixa')),
  resolvido BOOLEAN DEFAULT FALSE,
  resolvido_por TEXT,
  resolvido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DECISION LOGS (auditoria)
CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decisao_id UUID NOT NULL REFERENCES decisoes(id),
  acao TEXT NOT NULL,
  usuario TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_leads_pessoa ON leads(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score_prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_negocios_pessoa ON negocios(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_negocio ON oportunidades(negocio_id);
CREATE INDEX IF NOT EXISTS idx_decisoes_status ON decisoes(status, resolvido);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE decisoes;
ALTER PUBLICATION supabase_realtime ADD TABLE conversas;

-- RLS
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico_pessoas"       ON pessoas       FOR ALL USING (true);
CREATE POLICY "acesso_publico_leads"         ON leads         FOR ALL USING (true);
CREATE POLICY "acesso_publico_negocios"      ON negocios      FOR ALL USING (true);
CREATE POLICY "acesso_publico_oportunidades" ON oportunidades FOR ALL USING (true);
CREATE POLICY "acesso_publico_parceiros"     ON parceiros     FOR ALL USING (true);
CREATE POLICY "acesso_publico_campanhas"     ON campanhas     FOR ALL USING (true);
CREATE POLICY "acesso_publico_conversas"     ON conversas     FOR ALL USING (true);
CREATE POLICY "acesso_publico_mensagens"     ON mensagens     FOR ALL USING (true);
CREATE POLICY "acesso_publico_agentes"       ON agentes       FOR ALL USING (true);
CREATE POLICY "acesso_publico_decisoes"      ON decisoes      FOR ALL USING (true);
CREATE POLICY "acesso_publico_decision_logs" ON decision_logs FOR ALL USING (true);
