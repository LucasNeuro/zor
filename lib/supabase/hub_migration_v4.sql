-- ============================================================
-- HUB MIGRATION V4 — ML + KPIs + Responsabilidades
-- ============================================================

-- KPIs DEFINIÇÃO — catálogo do que existe para medir
CREATE TABLE IF NOT EXISTS hub_kpis_definicao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('velocidade','qualidade','volume','financeiro','conversao','satisfacao')),
  como_calcular TEXT,
  aplicavel_a TEXT[] DEFAULT '{}',
  visivel_para TEXT[] DEFAULT '{}',
  editavel_por TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- KPIs METAS — meta configurada por agente
CREATE TABLE IF NOT EXISTS hub_kpis_metas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kpi_slug TEXT NOT NULL REFERENCES hub_kpis_definicao(slug),
  agente_slug TEXT NOT NULL,
  valor_meta NUMERIC(12,4) NOT NULL,
  valor_atencao NUMERIC(12,4),
  valor_critico NUMERIC(12,4),
  frequencia TEXT DEFAULT 'tempo_real' CHECK (frequencia IN ('tempo_real','horario','diario','semanal')),
  alertar_slug TEXT,
  precisa_aprovacao BOOLEAN DEFAULT false,
  definido_por TEXT,
  motivo TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kpi_slug, agente_slug)
);

-- KPIs RESULTADOS — valores reais medidos
CREATE TABLE IF NOT EXISTS hub_kpis_resultados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kpi_slug TEXT NOT NULL,
  agente_slug TEXT NOT NULL,
  valor NUMERIC(12,4) NOT NULL,
  periodo_inicio TIMESTAMPTZ NOT NULL,
  periodo_fim TIMESTAMPTZ NOT NULL,
  amostras INTEGER DEFAULT 1,
  dentro_da_meta BOOLEAN DEFAULT true,
  nivel_alerta TEXT DEFAULT 'ok' CHECK (nivel_alerta IN ('ok','atencao','critico')),
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RESPONSABILIDADES — quem cobra o quê de quem
CREATE TABLE IF NOT EXISTS hub_responsabilidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_slug TEXT NOT NULL,
  subordinado_slug TEXT NOT NULL,
  kpi_slug TEXT NOT NULL,
  descricao TEXT NOT NULL,
  frequencia TEXT DEFAULT 'diario',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supervisor_slug, subordinado_slug, kpi_slug)
);

-- ML OBSERVAÇÕES — o que o sistema viu
CREATE TABLE IF NOT EXISTS hub_ml_observacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'script_melhor','script_pior','horario_ideal','horario_ruim',
    'modelo_melhor','tom_ideal','segmento_forte','segmento_fraco',
    'escalada_desnecessaria','retrabalho_padrao','conversao_padrao',
    'personalidade_eficaz','sequencia_ideal'
  )),
  descricao TEXT NOT NULL,
  dados_observados JSONB NOT NULL,
  amostras INTEGER DEFAULT 0,
  periodo_inicio TIMESTAMPTZ NOT NULL,
  periodo_fim TIMESTAMPTZ NOT NULL,
  confianca NUMERIC(3,2) DEFAULT 0 CHECK (confianca BETWEEN 0 AND 1),
  validado BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ML SUGESTÕES — o que o sistema quer mudar
CREATE TABLE IF NOT EXISTS hub_ml_sugestoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  observacao_id UUID REFERENCES hub_ml_observacoes(id),
  agente_slug TEXT NOT NULL,
  supervisor_slug TEXT NOT NULL,
  tipo_mudanca TEXT NOT NULL CHECK (tipo_mudanca IN (
    'script','horario','modelo','tom','segmento','contexto',
    'personalidade','escalada','autonomia','desativar','criar_agente'
  )),
  titulo TEXT NOT NULL,
  o_que_observou TEXT NOT NULL,
  o_que_sugere TEXT NOT NULL,
  por_que TEXT NOT NULL,
  impacto_estimado TEXT NOT NULL,
  dados_antes JSONB DEFAULT '{}',
  dados_depois JSONB DEFAULT '{}',
  confianca NUMERIC(3,2) DEFAULT 0,
  amostras INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','aplicado','monitorando')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ML HISTÓRICO — resultado das mudanças aplicadas
CREATE TABLE IF NOT EXISTS hub_ml_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sugestao_id UUID REFERENCES hub_ml_sugestoes(id),
  agente_slug TEXT NOT NULL,
  tipo_mudanca TEXT NOT NULL,
  dados_aplicados JSONB NOT NULL,
  aplicado_em TIMESTAMPTZ DEFAULT NOW(),
  monitorar_ate TIMESTAMPTZ,
  resultado_kpi_antes JSONB DEFAULT '{}',
  resultado_kpi_depois JSONB DEFAULT '{}',
  funcionou BOOLEAN,
  impacto_real TEXT,
  aprendizado TEXT,
  encerrado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- AÇÕES DA IA — registro de toda ação tomada pela IA
CREATE TABLE IF NOT EXISTS hub_acoes_ia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'mensagem_enviada','lead_qualificado','lead_escalado',
    'script_executado','regra_aplicada','alerta_gerado',
    'sugestao_criada','aprovacao_solicitada','memoria_salva',
    'metrica_coletada','campanha_analisada','conteudo_revisado',
    'briefing_criado','relatorio_gerado'
  )),
  descricao TEXT NOT NULL,
  lead_id UUID,
  resultado TEXT,
  tokens_usados INTEGER DEFAULT 0,
  custo_brl NUMERIC(10,4) DEFAULT 0,
  sucesso BOOLEAN DEFAULT true,
  erro TEXT,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_hub_kpis_metas_agente ON hub_kpis_metas(agente_slug);
CREATE INDEX IF NOT EXISTS idx_hub_kpis_resultados_agente ON hub_kpis_resultados(agente_slug, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_ml_observacoes_agente ON hub_ml_observacoes(agente_slug, tipo);
CREATE INDEX IF NOT EXISTS idx_hub_ml_sugestoes_status ON hub_ml_sugestoes(status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_ml_historico_agente ON hub_ml_historico(agente_slug);
CREATE INDEX IF NOT EXISTS idx_hub_acoes_ia_agente ON hub_acoes_ia(agente_slug, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_responsabilidades_supervisor ON hub_responsabilidades(supervisor_slug);

-- TRIGGERS (usa set_atualizado_em que existe no banco)
CREATE TRIGGER hub_kpis_metas_ts BEFORE UPDATE ON hub_kpis_metas FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER hub_ml_sugestoes_ts BEFORE UPDATE ON hub_ml_sugestoes FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- RLS
ALTER TABLE hub_kpis_definicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_kpis_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_kpis_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_responsabilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_ml_observacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_ml_sugestoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_ml_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_acoes_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_kpis_definicao_acesso" ON hub_kpis_definicao FOR ALL USING (true);
CREATE POLICY "hub_kpis_metas_acesso" ON hub_kpis_metas FOR ALL USING (true);
CREATE POLICY "hub_kpis_resultados_acesso" ON hub_kpis_resultados FOR ALL USING (true);
CREATE POLICY "hub_responsabilidades_acesso" ON hub_responsabilidades FOR ALL USING (true);
CREATE POLICY "hub_ml_observacoes_acesso" ON hub_ml_observacoes FOR ALL USING (true);
CREATE POLICY "hub_ml_sugestoes_acesso" ON hub_ml_sugestoes FOR ALL USING (true);
CREATE POLICY "hub_ml_historico_acesso" ON hub_ml_historico FOR ALL USING (true);
CREATE POLICY "hub_acoes_ia_acesso" ON hub_acoes_ia FOR ALL USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE hub_ml_sugestoes;
ALTER PUBLICATION supabase_realtime ADD TABLE hub_kpis_resultados;
ALTER PUBLICATION supabase_realtime ADD TABLE hub_acoes_ia;
