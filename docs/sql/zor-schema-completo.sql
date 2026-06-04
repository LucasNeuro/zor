-- =============================================================================
-- ZOR / Escritório Virtual — schema completo (bootstrap manual Supabase)
-- Gerado: 2026-06-04
-- Executar no SQL Editor do projeto Supabase NOVO (vazio).
-- NAO executar duas vezes em BD ja populado sem revisao.
-- Ordem: extensoes -> lib/supabase base -> migrations -> gaps -> seed Zor
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ########## zor-00-prelude (funções antes dos triggers CRM) ##########
CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- ########## lib/supabase/hub_migration.sql ##########

-- hub_migration.sql
-- Sistema de IA e CRM Obra10+
-- Execute via: Supabase Dashboard â†’ SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS BASE
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_pessoas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  telefone      TEXT UNIQUE,
  email         TEXT,
  tipo          TEXT DEFAULT 'lead',
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pessoa_id       UUID REFERENCES hub_pessoas(id) ON DELETE CASCADE,
  fase            TEXT DEFAULT 'entrada',
  status_visual   TEXT DEFAULT 'normal',
  score           INTEGER DEFAULT 10,
  ia_ativa        BOOLEAN DEFAULT true,
  tipo            TEXT DEFAULT 'nao_identificado',
  valor_estimado  NUMERIC,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_conversas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID REFERENCES hub_leads(id) ON DELETE CASCADE,
  pessoa_id     UUID REFERENCES hub_pessoas(id),
  canal         TEXT DEFAULT 'whatsapp',
  status        TEXT DEFAULT 'ativa',
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_mensagens (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversa_id    UUID REFERENCES hub_conversas(id) ON DELETE CASCADE,
  lead_id        UUID REFERENCES hub_leads(id),
  pessoa_id      UUID REFERENCES hub_pessoas(id),
  remetente      TEXT NOT NULL,
  tipo_conteudo  TEXT DEFAULT 'texto',
  conteudo       TEXT,
  enviada_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 1 â€” IDENTIDADE DO AGENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_agente_identidade (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug       TEXT UNIQUE NOT NULL,
  nome              TEXT NOT NULL,
  descricao         TEXT,
  persona           TEXT,
  tom_voz           TEXT DEFAULT 'profissional e amigÃ¡vel',
  system_prompt_base TEXT NOT NULL DEFAULT '',
  nunca_dizer       JSONB DEFAULT '[]',
  sempre_dizer      JSONB DEFAULT '[]',
  modelo_padrao     TEXT DEFAULT 'haiku',
  avatar_url        TEXT,
  ativo             BOOLEAN DEFAULT true,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 2 â€” CONFIGURAÃ‡ÃƒO DO AGENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_agente_configuracao (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug                 TEXT UNIQUE NOT NULL REFERENCES hub_agente_identidade(agente_slug) ON DELETE CASCADE,
  horario_inicio              TIME DEFAULT '08:00',
  horario_fim                 TIME DEFAULT '18:00',
  dias_operacao               JSONB DEFAULT '[1,2,3,4,5]',
  sla_primeira_resposta_min   INTEGER DEFAULT 5,
  sla_resposta_seguinte_min   INTEGER DEFAULT 15,
  max_mensagens_dia           INTEGER DEFAULT 50,
  escalar_para                TEXT DEFAULT 'supervisor',
  mensagem_fora_horario       TEXT DEFAULT 'Estamos fora do horÃ¡rio. Retornaremos em breve.',
  ativo                       BOOLEAN DEFAULT true,
  criado_em                   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 3 â€” SCRIPTS DE ATENDIMENTO
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_scripts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id    UUID REFERENCES hub_agente_identidade(id) ON DELETE CASCADE,
  gatilho      TEXT NOT NULL,
  conteudo     TEXT NOT NULL,
  tipo         TEXT DEFAULT 'abordagem',
  ordem        INTEGER DEFAULT 0,
  ativo        BOOLEAN DEFAULT true,
  vezes_usado  INTEGER DEFAULT 0,
  conversoes   INTEGER DEFAULT 0,
  criado_em    TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 4 â€” REGRAS DE NEGÃ“CIO
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_regras_negocio (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id           UUID REFERENCES hub_agente_identidade(id) ON DELETE CASCADE,
  condicao_campo      TEXT NOT NULL,
  condicao_operador   TEXT NOT NULL,
  condicao_valor      TEXT NOT NULL,
  acao_tipo           TEXT NOT NULL,
  acao_valor          TEXT NOT NULL,
  prioridade          INTEGER DEFAULT 0,
  ativo               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 5 â€” MEMÃ“RIAS DO LEAD
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_memorias_lead (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id                 UUID UNIQUE REFERENCES hub_leads(id) ON DELETE CASCADE,
  dados_coletados         JSONB DEFAULT '{}',
  preferencias_detectadas JSONB DEFAULT '{}',
  nivel_engajamento       INTEGER DEFAULT 5,
  humor_predominante      TEXT,
  resumo_ia               TEXT,
  ultima_interacao        TIMESTAMPTZ DEFAULT NOW(),
  criado_em               TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 6 â€” LOGS DE PROMPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_prompt_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id             UUID REFERENCES hub_leads(id),
  conversa_id         UUID REFERENCES hub_conversas(id),
  agente_slug         TEXT,
  system_prompt       TEXT,
  mensagem_usuario    TEXT,
  resposta_ia         TEXT,
  modelo_usado        TEXT,
  tokens_input        INTEGER,
  tokens_output       INTEGER,
  custo_estimado_brl  NUMERIC,
  tempo_resposta_ms   INTEGER,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 7 â€” FILA DE MENSAGENS
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_fila_mensagens (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id               UUID REFERENCES hub_leads(id),
  conversa_id           UUID REFERENCES hub_conversas(id),
  whatsapp_message_id   TEXT,
  remetente_numero      TEXT,
  conteudo              TEXT,
  status                TEXT DEFAULT 'pendente',
  agente_responsavel    TEXT DEFAULT 'atendente',
  tentativas            INTEGER DEFAULT 0,
  processado_em         TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 8 â€” CONFIGURAÃ‡ÃƒO WHATSAPP
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_whatsapp_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  numero_telefone TEXT,
  verify_token    TEXT,
  webhook_url     TEXT,
  token_acesso    TEXT,
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 9 â€” PADRÃ•ES DE ML
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_ml_padroes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo         TEXT NOT NULL,
  padrao       TEXT NOT NULL,
  agente_id    UUID REFERENCES hub_agente_identidade(id) ON DELETE CASCADE,
  frequencia   INTEGER DEFAULT 1,
  efetividade  NUMERIC DEFAULT 0,
  ultima_vez   TIMESTAMPTZ DEFAULT NOW(),
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÃNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_hub_leads_pessoa_id      ON hub_leads(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_hub_conversas_lead_id    ON hub_conversas(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_mensagens_conversa   ON hub_mensagens(conversa_id, enviada_em);
CREATE INDEX IF NOT EXISTS idx_hub_memorias_lead_id     ON hub_memorias_lead(lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_prompt_logs_lead     ON hub_prompt_logs(lead_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_hub_fila_status          ON hub_fila_mensagens(status, tentativas);
CREATE INDEX IF NOT EXISTS idx_hub_ml_agente_tipo       ON hub_ml_padroes(agente_id, tipo);

-- ============================================================
-- TRIGGER atualizado_em
-- ============================================================

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hub_pessoas','hub_leads','hub_conversas',
    'hub_agente_identidade','hub_agente_configuracao',
    'hub_scripts','hub_memorias_lead','hub_whatsapp_config'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_atualizado ON %s', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_atualizado BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE hub_agente_identidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_prompt_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_memorias_lead     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_identidade" ON hub_agente_identidade;
CREATE POLICY "service_all_identidade" ON hub_agente_identidade FOR ALL USING (true);

DROP POLICY IF EXISTS "service_all_logs" ON hub_prompt_logs;
CREATE POLICY "service_all_logs" ON hub_prompt_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "service_all_memorias" ON hub_memorias_lead;
CREATE POLICY "service_all_memorias" ON hub_memorias_lead FOR ALL USING (true);

-- ============================================================
-- REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hub_conversas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hub_mensagens;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE hub_fila_mensagens;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED â€” Agente Ariane
-- ============================================================

INSERT INTO hub_agente_identidade
  (agente_slug, nome, descricao, tom_voz, system_prompt_base, nunca_dizer, sempre_dizer, modelo_padrao)
VALUES (
  'atendente',
  'Ariane',
  'Agente de atendimento e qualificaÃ§Ã£o inicial de leads',
  'caloroso, profissional e empÃ¡tico',
  'VocÃª Ã© Ariane, assistente virtual da Obra10+, especializada em atendimento de clientes para projetos de construÃ§Ã£o e reformas. Seu objetivo Ã© qualificar leads, entender suas necessidades e conectÃ¡-los com a equipe certa. Seja cordial, objetiva e nunca deixe o cliente sem resposta.',
  '["nÃ£o sei","nÃ£o posso","impossÃ­vel","nÃ£o faÃ§o ideia"]',
  '["Obra10+"]',
  'haiku'
)
ON CONFLICT (agente_slug) DO NOTHING;

INSERT INTO hub_agente_configuracao
  (agente_slug, horario_inicio, horario_fim, sla_primeira_resposta_min, escalar_para, mensagem_fora_horario)
VALUES (
  'atendente',
  '08:00',
  '18:00',
  5,
  'supervisor',
  'OlÃ¡! Estamos fora do horÃ¡rio de atendimento (segâ€“sex, 8hâ€“18h). Sua mensagem foi recebida e retornaremos assim que possÃ­vel. Obrigado por entrar em contato com a Obra10+!'
)
ON CONFLICT (agente_slug) DO NOTHING;


-- ########## lib/supabase/hub_migration_crm.sql ##########

-- CRM Pipeline Migration â€” hub_migration_crm.sql
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
  secao TEXT NOT NULL CHECK (secao IN ('empresa','servicos','atendimento','proibicoes','exemplos','objeccoes','fluxo_sdr')),
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

-- REALTIME (idempotente: no Supabase, reler o script falha com 42710 se a tabela jÃ¡ estiver na publicaÃ§Ã£o)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hub_leads_crm', 'hub_atividades', 'hub_propostas']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- SEED SERVICES
INSERT INTO hub_servicos (nome, descricao, categoria, faixa_preco_min, faixa_preco_max, publico_alvo, entregaveis, prazo_medio_dias) VALUES
('GestÃ£o de TrÃ¡fego Meta Ads', 'CriaÃ§Ã£o e gestÃ£o de campanhas no Facebook e Instagram Ads', 'trafego', 1500, 5000, 'Empresas que querem leads via Meta', 'Campanhas configuradas, relatÃ³rio semanal, otimizaÃ§Ã£o contÃ­nua', 30),
('GestÃ£o de TrÃ¡fego Google Ads', 'CriaÃ§Ã£o e gestÃ£o de campanhas no Google Search e Display', 'trafego', 1500, 5000, 'Empresas que querem leads via Google', 'Campanhas configuradas, relatÃ³rio semanal, otimizaÃ§Ã£o contÃ­nua', 30),
('GestÃ£o de TrÃ¡fego Completa', 'Meta Ads + Google Ads + relatÃ³rios integrados', 'trafego', 3000, 8000, 'Empresas que querem escala', 'Todas as plataformas, dashboard unificado', 30),
('Landing Page', 'CriaÃ§Ã£o de pÃ¡gina de captura otimizada para conversÃ£o', 'sites', 1500, 4000, 'Empresas que precisam converter trÃ¡fego', 'PÃ¡gina publicada, pixel instalado, formulÃ¡rio integrado', 15),
('Site Institucional', 'Site completo com pÃ¡ginas institucionais', 'sites', 3000, 8000, 'Empresas sem presenÃ§a digital', 'Site publicado, responsivo, com SEO bÃ¡sico', 30),
('ProduÃ§Ã£o de ConteÃºdo', 'Posts, legendas, stories e reels para redes sociais', 'conteudo', 800, 2500, 'Empresas que precisam de presenÃ§a nas redes', '20 posts/mÃªs, artes e legendas', 30),
('Consultoria de Marketing', 'DiagnÃ³stico e plano estratÃ©gico de marketing digital', 'consultoria', 2000, 5000, 'Empresas que precisam de direÃ§Ã£o', 'RelatÃ³rio diagnÃ³stico + plano de aÃ§Ã£o 90 dias', 15),
('CRM e AutomaÃ§Ã£o', 'ConfiguraÃ§Ã£o de CRM e fluxos de automaÃ§Ã£o de atendimento', 'crm', 2000, 6000, 'Empresas com volume de leads', 'CRM configurado, fluxos ativos, treinamento da equipe', 20)
ON CONFLICT (nome) DO NOTHING;


-- ########## lib/supabase/hub_migration_v3.sql ##########

-- ============================================================
-- HUB MIGRATION V3 â€” Tabelas completas do organismo
-- ============================================================

-- APROVAÃ‡Ã•ES â€” fila de aprovaÃ§Ãµes para o humano
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

-- ARQUIVOS DE MÃDIA â€” imagens, vÃ­deos, Ã¡udios, documentos
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

-- CONVERSAS LOG â€” registro completo de conversas
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

-- MÃ‰TRICAS DE TRÃFEGO â€” CPL, ROAS, CTR por campanha
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

-- PERSONALIDADE DOS AGENTES â€” matriz 5x5
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

-- BRIEFINGS â€” projetos, conteÃºdo e campanhas
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

-- QUALIDADE DOS AGENTES â€” mÃ©tricas de performance
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

-- ÃNDICES
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

-- SEED PERSONALIDADE â€” matriz 5x5 para os 5 agentes
INSERT INTO hub_personalidade (agente_slug, humor, personalidade, humor_label, personalidade_label, combinacao_label, descricao_comportamento, tom_comunicacao) VALUES
('atendente', 2, 2, 'EmpÃ¡tico', 'Profissional', 'Acolhedor Profissional', 'Atende com empatia e profissionalismo. Ouve antes de falar. Resolve sem prometer o que nÃ£o pode.', 'caloroso e direto'),
('sdr', 1, 2, 'Focado', 'Profissional', 'Executor Profissional', 'Qualifica rapidamente. Faz as perguntas certas. NÃ£o perde tempo com leads invÃ¡lidos.', 'objetivo e confiante'),
('gerente_atendimento', 3, 1, 'AnalÃ­tico', 'Formal', 'Analista Formal', 'Supervisiona com dados. Cobra resultados. Toma decisÃµes baseadas em mÃ©tricas.', 'formal e preciso'),
('ariane', 4, 2, 'Criativo', 'Profissional', 'Criativo EstratÃ©gico', 'Pensa fora da caixa. PropÃµe alternativas. Dirige com visÃ£o de negÃ³cio.', 'inspirador e estratÃ©gico'),
('ceo', 3, 1, 'AnalÃ­tico', 'Formal', 'Estrategista Executivo', 'VisÃ£o macro. Decide com dados. Foco em resultado e crescimento sustentÃ¡vel.', 'executivo e estratÃ©gico')
ON CONFLICT (agente_slug) DO NOTHING;


-- ########## lib/supabase/hub_migration_v4.sql ##########

-- ============================================================
-- HUB MIGRATION V4 â€” ML + KPIs + Responsabilidades
-- ============================================================

-- KPIs DEFINIÃ‡ÃƒO â€” catÃ¡logo do que existe para medir
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

-- KPIs METAS â€” meta configurada por agente
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

-- KPIs RESULTADOS â€” valores reais medidos
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

-- RESPONSABILIDADES â€” quem cobra o quÃª de quem
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

-- ML OBSERVAÃ‡Ã•ES â€” o que o sistema viu
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

-- ML SUGESTÃ•ES â€” o que o sistema quer mudar
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

-- ML HISTÃ“RICO â€” resultado das mudanÃ§as aplicadas
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

-- AÃ‡Ã•ES DA IA â€” registro de toda aÃ§Ã£o tomada pela IA
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

-- ÃNDICES
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


-- ########## lib/supabase/hub_migration_seguranca.sql ##########

-- ============================================================
-- HUB MIGRATION SEGURANÃ‡A â€” RLS por camada IA vs Humano
-- ============================================================

-- FunÃ§Ã£o para detectar service_role (humano via painel)
CREATE OR REPLACE FUNCTION hub_is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('role', true) = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CAMADA 1 â€” IMUTÃVEL (somente leitura para todos)
-- ============================================================

COMMENT ON TABLE hub_kpis_definicao IS 'CAMADA 1 IMUTÃVEL: Alterada apenas por migrations de cÃ³digo. IA e humano tÃªm somente leitura.';
COMMENT ON TABLE hub_responsabilidades IS 'CAMADA 1 IMUTÃVEL: Alterada apenas por migrations de cÃ³digo. IA e humano tÃªm somente leitura.';

-- ============================================================
-- CAMADA 2 â€” CONFIGURÃVEL (somente humano via service_role)
-- ============================================================

COMMENT ON TABLE hub_agente_identidade IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_agente_configuracao IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_hierarquia IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_personalidade IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_kpis_metas IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_briefings IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_ml_historico IS 'CAMADA 2 CONFIGURÃVEL: Somente humano via painel (service_role). IA tem somente leitura.';

-- Remover polÃ­ticas antigas abertas das tabelas configurÃ¡veis
DROP POLICY IF EXISTS "hub_agente_identidade_acesso" ON hub_agente_identidade;
DROP POLICY IF EXISTS "hub_agente_configuracao_acesso" ON hub_agente_configuracao;
DROP POLICY IF EXISTS "hub_hierarquia_acesso" ON hub_hierarquia;
DROP POLICY IF EXISTS "hub_personalidade_acesso" ON hub_personalidade;
DROP POLICY IF EXISTS "hub_kpis_metas_acesso" ON hub_kpis_metas;
DROP POLICY IF EXISTS "hub_briefings_acesso" ON hub_briefings;
DROP POLICY IF EXISTS "hub_ml_historico_acesso" ON hub_ml_historico;

-- hub_agente_identidade
CREATE POLICY "hub_agente_identidade_ler" ON hub_agente_identidade FOR SELECT USING (true);
CREATE POLICY "hub_agente_identidade_escrever" ON hub_agente_identidade FOR ALL USING (hub_is_service_role());

-- hub_agente_configuracao
CREATE POLICY "hub_agente_configuracao_ler" ON hub_agente_configuracao FOR SELECT USING (true);
CREATE POLICY "hub_agente_configuracao_escrever" ON hub_agente_configuracao FOR ALL USING (hub_is_service_role());

-- hub_hierarquia
CREATE POLICY "hub_hierarquia_ler" ON hub_hierarquia FOR SELECT USING (true);
CREATE POLICY "hub_hierarquia_escrever" ON hub_hierarquia FOR ALL USING (hub_is_service_role());

-- hub_personalidade
CREATE POLICY "hub_personalidade_ler" ON hub_personalidade FOR SELECT USING (true);
CREATE POLICY "hub_personalidade_escrever" ON hub_personalidade FOR ALL USING (hub_is_service_role());

-- hub_kpis_metas
CREATE POLICY "hub_kpis_metas_ler" ON hub_kpis_metas FOR SELECT USING (true);
CREATE POLICY "hub_kpis_metas_escrever" ON hub_kpis_metas FOR ALL USING (hub_is_service_role());

-- hub_briefings
CREATE POLICY "hub_briefings_ler" ON hub_briefings FOR SELECT USING (true);
CREATE POLICY "hub_briefings_escrever" ON hub_briefings FOR ALL USING (hub_is_service_role());

-- hub_ml_historico
CREATE POLICY "hub_ml_historico_ler" ON hub_ml_historico FOR SELECT USING (true);
CREATE POLICY "hub_ml_historico_escrever" ON hub_ml_historico FOR ALL USING (hub_is_service_role());

-- ============================================================
-- CAMADA 3 â€” OPERACIONAL (IA insere/lÃª; humano lÃª+escreve)
-- ============================================================

COMMENT ON TABLE hub_ml_observacoes IS 'CAMADA 3 OPERACIONAL: IA insere observaÃ§Ãµes. Humano lÃª via painel.';
COMMENT ON TABLE hub_ml_sugestoes IS 'CAMADA 3 OPERACIONAL: IA insere sugestÃµes. Humano aprova/rejeita.';
COMMENT ON TABLE hub_acoes_ia IS 'CAMADA 3 OPERACIONAL: Registro imutÃ¡vel de aÃ§Ãµes da IA.';
COMMENT ON TABLE hub_kpis_resultados IS 'CAMADA 3 OPERACIONAL: IA registra mediÃ§Ãµes. Humano lÃª via painel.';
COMMENT ON TABLE hub_aprovacoes IS 'CAMADA 3 OPERACIONAL: IA cria aprovaÃ§Ãµes. Humano decide.';

-- ============================================================
-- TABELA DE AUDITORIA DE SEGURANÃ‡A
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_auditoria_seguranca (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origem TEXT NOT NULL CHECK (origem IN ('ia', 'humano')),
  tabela TEXT NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('ler', 'inserir', 'atualizar', 'deletar')),
  motivo TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_auditoria_origem ON hub_auditoria_seguranca(origem, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_auditoria_tabela ON hub_auditoria_seguranca(tabela);

ALTER TABLE hub_auditoria_seguranca ENABLE ROW LEVEL SECURITY;

-- IA pode inserir tentativas bloqueadas (para auditoria)
CREATE POLICY "hub_auditoria_ia_inserir" ON hub_auditoria_seguranca FOR INSERT WITH CHECK (true);
-- Somente humano (service_role) lÃª a auditoria
CREATE POLICY "hub_auditoria_humano_ler" ON hub_auditoria_seguranca FOR SELECT USING (hub_is_service_role());


-- ########## supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql ##########

-- Alinhamento Documento Mestre: slugs de ciclos do Diretor + base multi-tenant.
-- Executar no Supabase (SQL editor ou CLI). Sem DROP destrutivo.

-- 1) Tabela de tenants (Fase 4)
CREATE TABLE IF NOT EXISTS hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant padrÃ£o para dados legados (UUID fixo facilita app e RLS futura)
INSERT INTO hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

-- 2) Colunas tenant_id em tabelas centrais (nullable â†’ backfill â†’ NOT NULL opcional depois)
ALTER TABLE hub_leads_crm ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_agente_identidade ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_fila_mensagens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_parceiros ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);

UPDATE hub_leads_crm SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_agente_identidade SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_fila_mensagens SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_parceiros SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;

-- 3) Slugs de ciclos: trÃ¡fego â†’ diretor_operacoes; restantes legados "diretor" â†’ diretor_geral_ia
UPDATE hub_ciclos_ia
SET agente_slug = 'diretor_operacoes'
WHERE agente_slug = 'diretor'
  AND (
    nome ILIKE '%trÃ¡fego%'
    OR nome ILIKE '%trafego%'
    OR nome ILIKE '%campanha%'
  );

UPDATE hub_ciclos_ia
SET agente_slug = 'diretor_geral_ia'
WHERE agente_slug = 'diretor';

-- 4) Alertas antigos com slug inexistente (ajuste best-effort)
UPDATE hub_alertas SET agente_slug = 'diretor_geral_ia' WHERE agente_slug = 'diretor';


-- ########## supabase/migrations/20260510130000_rls_tenant_pilot.sql ##########

-- RLS piloto multi-tenant (Documento Mestre / melhorias recomendadas).
-- PrÃ©-requisito: 20260509120000_hub_ciclos_slugs_e_tenants.sql (colunas tenant_id preenchidas).
-- Service role do Supabase continua a ignorar RLS (uso nas rotas Next).

-- Helpers: claim JWT customizado "tenant_id" (UUID). Documentar no Supabase Auth > JWT template.
CREATE OR REPLACE FUNCTION public.app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(COALESCE(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.app_tenant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_obra10_tenant_id() TO anon, authenticated;

-- CatÃ¡logo de tenants: leitura pÃºblica mÃ­nima (slugs ativos)
ALTER TABLE hub_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_tenants_select_authenticated ON hub_tenants;
DROP POLICY IF EXISTS hub_tenants_select_anon ON hub_tenants;
CREATE POLICY hub_tenants_select_anon ON hub_tenants
  FOR SELECT TO anon USING (ativo = true);
CREATE POLICY hub_tenants_select_authenticated ON hub_tenants
  FOR SELECT TO authenticated USING (ativo = true);

-- Tabelas com tenant_id: anon sÃ³ vÃª/edita tenant Obra10 legado; authenticated sÃ³ com claim tenant_id
ALTER TABLE hub_leads_crm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_leads_crm_anon_default ON hub_leads_crm;
DROP POLICY IF EXISTS hub_leads_crm_auth_claim ON hub_leads_crm;
CREATE POLICY hub_leads_crm_anon_default ON hub_leads_crm
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_leads_crm_auth_claim ON hub_leads_crm
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_parceiros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_parceiros_anon_default ON hub_parceiros;
DROP POLICY IF EXISTS hub_parceiros_auth_claim ON hub_parceiros;
CREATE POLICY hub_parceiros_anon_default ON hub_parceiros
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_parceiros_auth_claim ON hub_parceiros
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_agente_identidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_agente_identidade_anon_default ON hub_agente_identidade;
DROP POLICY IF EXISTS hub_agente_identidade_auth_claim ON hub_agente_identidade;
CREATE POLICY hub_agente_identidade_anon_default ON hub_agente_identidade
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_agente_identidade_auth_claim ON hub_agente_identidade
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_fila_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_fila_mensagens_anon_default ON hub_fila_mensagens;
DROP POLICY IF EXISTS hub_fila_mensagens_auth_claim ON hub_fila_mensagens;
CREATE POLICY hub_fila_mensagens_anon_default ON hub_fila_mensagens
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_fila_mensagens_auth_claim ON hub_fila_mensagens
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());


-- ########## supabase/migrations/20260510140000_hub_cotacoes.sql ##########

-- CotaÃ§Ãµes fornecedor (Fase 3) + integraÃ§Ã£o com aprovaÃ§Ãµes humanas.

CREATE TABLE IF NOT EXISTS hub_cotacoes_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES hub_tenants(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'cotando', 'em_aprovacao', 'aprovado', 'rejeitado', 'cancelado')),
  aprovacao_id UUID REFERENCES hub_aprovacoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_cotacoes_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES hub_cotacoes_pedidos(id) ON DELETE CASCADE,
  fornecedor_nome TEXT NOT NULL,
  valor_total NUMERIC(12, 2),
  prazo_dias INTEGER,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_cotacoes_pedidos_tenant ON hub_cotacoes_pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_cotacoes_respostas_pedido ON hub_cotacoes_respostas(pedido_id);

UPDATE hub_cotacoes_pedidos
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

-- RLS alinhado Ã s outras tabelas hub_* com tenant
ALTER TABLE hub_cotacoes_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_cotacoes_pedidos_anon ON hub_cotacoes_pedidos;
DROP POLICY IF EXISTS hub_cotacoes_pedidos_auth ON hub_cotacoes_pedidos;
CREATE POLICY hub_cotacoes_pedidos_anon ON hub_cotacoes_pedidos
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_cotacoes_pedidos_auth ON hub_cotacoes_pedidos
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_cotacoes_respostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_cotacoes_respostas_anon ON hub_cotacoes_respostas;
DROP POLICY IF EXISTS hub_cotacoes_respostas_auth ON hub_cotacoes_respostas;
CREATE POLICY hub_cotacoes_respostas_anon ON hub_cotacoes_respostas
  FOR ALL TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = default_obra10_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = default_obra10_tenant_id()
    )
  );
CREATE POLICY hub_cotacoes_respostas_auth ON hub_cotacoes_respostas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = app_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = app_tenant_id()
    )
  );


-- ########## supabase/migrations/20260511120000_app_role_owner_admin.sql ##########

-- PapÃ©is de backoffice em public.app_role (idempotente: ignora se o valor jÃ¡ existir).
-- Ajuste os nomes se o teu enum jÃ¡ tiver outros rÃ³tulos.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'owner'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ########## supabase/migrations/20260511120000_hub_agente_avatar_url.sql ##########

ALTER TABLE hub_agente_identidade ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- ########## supabase/migrations/20260512120000_hub_autonomia_matriz.sql ##########

-- Matriz de autonomia configurÃ¡vel (complementa hub_hierarquia.limite_autonomia_brl e criterios_escalonamento).
-- ReferÃªncia: hub_agente_identidade.agente_slug (UNIQUE) â€” alinhado ao schema em contexto.
-- Ordem de avaliaÃ§Ã£o no cÃ³digo: regras da matriz (prioridade DESC) â†’ depois fallback hub_hierarquia.

CREATE TABLE IF NOT EXISTS public.hub_autonomia_matriz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug text NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON UPDATE CASCADE ON DELETE CASCADE,
  canal text CHECK (
    canal IS NULL
    OR canal = '*'
    OR canal = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'email'::text, 'interno'::text, 'site'::text])
  ),
  nome text NOT NULL,
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  limite_autonomia_brl numeric,
  palavras_chave text[] NOT NULL DEFAULT '{}'::text[],
  regex_opcional text,
  observacao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_autonomia_matriz_agente_canal
  ON public.hub_autonomia_matriz(agente_slug, ativo)
  WHERE ativo = true;

COMMENT ON TABLE public.hub_autonomia_matriz IS
  'Regras por agente/canal: gatilhos na mensagem + limite BRL ou exige_aprovacao. canal NULL ou * = todos.';

ALTER TABLE public.hub_autonomia_matriz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_autonomia_matriz_service_all ON public.hub_autonomia_matriz;
CREATE POLICY hub_autonomia_matriz_service_all ON public.hub_autonomia_matriz
  FOR ALL USING (true) WITH CHECK (true);


-- ########## supabase/migrations/20260513120000_hub_crm_agente_briefing_chat.sql ##########

-- Chat de briefing interno (CRM): histÃ³rico persistente, isolado do fluxo WhatsApp/leads.
-- Service role nas rotas /api/hub/* usa a mesma polÃ­tica permissiva dos demais hubs internos.

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

COMMENT ON TABLE public.hub_crm_agente_briefing_sessao IS 'SessÃ£o de chat briefing interno CRM â†” agente (nÃ£o Ã© conversa de lead).';
COMMENT ON TABLE public.hub_crm_agente_briefing_mensagem IS 'Mensagens do briefing; metadata pode guardar tokens/modelo/custo.';

ALTER TABLE public.hub_crm_agente_briefing_sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_crm_agente_briefing_mensagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_crm_briefing_sessao_service_all ON public.hub_crm_agente_briefing_sessao;
CREATE POLICY hub_crm_briefing_sessao_service_all ON public.hub_crm_agente_briefing_sessao
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_crm_briefing_msg_service_all ON public.hub_crm_agente_briefing_mensagem;
CREATE POLICY hub_crm_briefing_msg_service_all ON public.hub_crm_agente_briefing_mensagem
  FOR ALL USING (true) WITH CHECK (true);


-- ########## supabase/migrations/20260514000000_ensure_hub_pessoas.sql ##########

-- Tabela base hub_pessoas (cadastro CRM PF/PJ).
-- PrÃ©-requisito para 20260515120000_vw_hub_leads_crm_enriquecido e 20260521130000_hub_pessoas_area_endereco.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.hub_pessoas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT,
  nome            TEXT NOT NULL,
  telefone        TEXT,
  email           TEXT,
  documento       TEXT,
  tipo            TEXT NOT NULL DEFAULT 'lead',
  tipo_pessoa     TEXT,
  empresa         TEXT,
  origem          TEXT,
  area_atuacao    TEXT,
  cep             TEXT,
  logradouro      TEXT,
  bairro          TEXT,
  cidade          TEXT,
  estado          TEXT,
  tenant_id       UUID,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_pessoas_tipo_pessoa_chk
    CHECK (tipo_pessoa IS NULL OR tipo_pessoa IN ('PF', 'PJ'))
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_pessoas_telefone_unique
  ON public.hub_pessoas (telefone)
  WHERE telefone IS NOT NULL AND telefone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS hub_pessoas_documento_unique
  ON public.hub_pessoas (documento)
  WHERE documento IS NOT NULL AND documento <> '';

CREATE INDEX IF NOT EXISTS idx_hub_pessoas_tipo_pessoa ON public.hub_pessoas (tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_hub_pessoas_tenant ON public.hub_pessoas (tenant_id);

COMMENT ON TABLE public.hub_pessoas IS 'Pessoas/contatos do CRM (clientes PF/PJ, leads, parceiros).';


-- ########## supabase/migrations/20260514130000_hub_agent_playbooks_storage.sql ##########

-- Playbooks Agno: ficheiros Markdown no Storage + metadados no agente
-- Bucket pÃºblico (leitura) para URLs estÃ¡veis; escrita via service_role na API.

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS playbook_object_path TEXT,
  ADD COLUMN IF NOT EXISTS playbook_public_url TEXT,
  ADD COLUMN IF NOT EXISTS playbook_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS playbook_source_hash TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.playbook_object_path IS 'Caminho no bucket hub-agent-playbooks (ex.: {tenant}/{slug}.md).';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_public_url IS 'URL pÃºblica do Markdown (Supabase getPublicUrl).';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_generated_at IS 'Ãšltima geraÃ§Ã£o do playbook.';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_source_hash IS 'SHA-256 do snapshot canÃ³nico usado na Ãºltima geraÃ§Ã£o.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-agent-playbooks',
  'hub-agent-playbooks',
  true,
  5242880,
  ARRAY['text/markdown', 'text/plain', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "hub_agent_playbooks_select_public" ON storage.objects;
CREATE POLICY "hub_agent_playbooks_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hub-agent-playbooks');

-- Upload/update/delete: usar SUPABASE_SERVICE_ROLE_KEY na API Next.js (contorna RLS).


-- ########## supabase/migrations/20260515120000_vw_hub_leads_crm_enriquecido.sql ##########

-- Vista enriquecida: hub_leads_crm + hub_pessoas + Ãºltima linha hub_fila_mensagens (mesmo lead_id CRM).
-- Leitura via PostgREST: expÃµe colunas calculadas para relatÃ³rios / futuras telas.
-- A app pode continuar a usar hub_leads_crm + merge no cliente se preferir.

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pessoa_id UUID;

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS estado TEXT;

CREATE INDEX IF NOT EXISTS idx_hub_fila_mensagens_lead_criado
  ON public.hub_fila_mensagens (lead_id, criado_em DESC NULLS LAST);

DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;

-- CÃ³digo PES: vem de hub_pessoas.codigo, exposto na view como pessoa_codigo (evita nome genÃ©rico "codigo").
CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''::text), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

COMMENT ON VIEW public.vw_hub_leads_crm_enriquecido IS
  'hub_leads_crm.* + enriquecimento: pessoa_codigo = cÃ³digo PES (hub_pessoas.codigo); email_exibicao; Ãºltima linha hub_fila_mensagens onde lead_id = id do CRM.';


-- ########## supabase/migrations/20260516120000_hub_agente_ferramentas_mistral.sql ##########

-- Ferramentas de IA por agente + provisionamento opcional na API Mistral (Agents).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS motor_ferramentas_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uso_ferramentas_ia jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mistral_agent_id text,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_em timestamptz,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_erro text;

COMMENT ON COLUMN public.hub_agente_identidade.motor_ferramentas_habilitado IS
  'Se true, o motor de atendimento pode invocar ferramentas (function calling) quando o modelo Ã© Mistral.';
COMMENT ON COLUMN public.hub_agente_identidade.mistral_agent_sync_habilitado IS
  'Se true, cria/atualiza um registo em beta Agents da Mistral alinhado a este agente Hub.';
COMMENT ON COLUMN public.hub_agente_identidade.uso_ferramentas_ia IS
  'Mapa { "tool_id": true|false } â€” sÃ³ tools conhecidas pelo servidor sÃ£o permitidas.';
COMMENT ON COLUMN public.hub_agente_identidade.mistral_agent_id IS
  'ID devolvido pela Mistral ao provisionar o agente (Agents API).';


-- ########## supabase/migrations/20260516120000_hub_crm_atendimento_cols.sql ##########

-- Colunas usadas pela Central de Atendimento (API send + leads).
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultimo_contato TIMESTAMPTZ;

ALTER TABLE public.hub_fila_mensagens ADD COLUMN IF NOT EXISTS enviada_em TIMESTAMPTZ;
ALTER TABLE public.hub_fila_mensagens ADD COLUMN IF NOT EXISTS resposta_enviada BOOLEAN DEFAULT FALSE;


-- ########## supabase/migrations/20260519180000_hub_delete_crm_cadastro_rpc.sql ##########

-- ExclusÃ£o de contactos/empresas no CRM com SET LOCAL app.delete_authorized = true
-- (obrigatÃ³rio quando existe trigger block_unauthorized_delete em hub_pessoas / hub_empresas).

CREATE OR REPLACE FUNCTION public.hub_delete_pessoa_crm(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row hub_pessoas%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID invÃ¡lido');
  END IF;

  SELECT * INTO v_row FROM hub_pessoas WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pessoa nÃ£o encontrada.');
  END IF;

  UPDATE hub_leads_crm SET pessoa_id = NULL WHERE pessoa_id = p_id;
  UPDATE hub_negocios SET pessoa_id = NULL WHERE pessoa_id = p_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_leads' AND column_name = 'pessoa_id'
  ) THEN
    UPDATE hub_leads SET pessoa_id = NULL WHERE pessoa_id = p_id;
  END IF;

  SET LOCAL app.delete_authorized = true;
  DELETE FROM hub_pessoas WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok',
    true,
    'id',
    p_id,
    'codigo',
    v_row.codigo,
    'nome',
    v_row.nome
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'NÃ£o Ã© possÃ­vel excluir: este cadastro estÃ¡ vinculado a outros registros do sistema.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_delete_empresa_crm(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row hub_empresas%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ID invÃ¡lido');
  END IF;

  SELECT * INTO v_row FROM hub_empresas WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empresa nÃ£o encontrada.');
  END IF;

  SET LOCAL app.delete_authorized = true;
  DELETE FROM hub_empresas WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok',
    true,
    'id',
    p_id,
    'codigo',
    v_row.codigo,
    'razao_social',
    v_row.razao_social
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'NÃ£o Ã© possÃ­vel excluir: esta empresa estÃ¡ vinculada a outros registros do sistema.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_pessoa_crm(uuid) IS
  'Apaga contacto em hub_pessoas; desvincula leads/negÃ³cios; usa app.delete_authorized.';

COMMENT ON FUNCTION public.hub_delete_empresa_crm(uuid) IS
  'Apaga empresa em hub_empresas; usa app.delete_authorized.';

REVOKE ALL ON FUNCTION public.hub_delete_pessoa_crm(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_delete_empresa_crm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_pessoa_crm(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_delete_empresa_crm(uuid) TO service_role;


-- ########## supabase/migrations/20260520120000_ensure_hub_fila_mensagens_tenant.sql ##########

-- Corrige: "Could not find the 'tenant_id' column of 'hub_fila_mensagens' in the schema cache"
-- quando o projeto Supabase nÃ£o executou ainda 20260509120000_hub_ciclos_slugs_e_tenants.sql.
-- Idempotente: seguro correr vÃ¡rias vezes.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.hub_fila_mensagens
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_fila_mensagens
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

-- ApÃ³s correr: no Dashboard Supabase â†’ Project Settings â†’ API â†’ "Reload schema" se o erro de cache persistir.


-- ########## supabase/migrations/20260520120000_hub_parceiros_codigo_link_rede.sql ##########

-- CÃ³digo Ãºnico por parceiro + link pÃºblico reutilizÃ¡vel da rede
ALTER TABLE public.hub_parceiros
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hub_parceiros_codigo_unique
  ON public.hub_parceiros (codigo)
  WHERE codigo IS NOT NULL;

-- Link Ãºnico permanente (vÃ¡rios cadastros pelo mesmo URL)
INSERT INTO public.hub_links_cadastro (token, tipo, criado_por, expira_em, metadata)
SELECT
  'rede',
  'parceiro',
  'sistema',
  '2099-12-31T23:59:59+00'::timestamptz,
  '{"reutilizavel":true,"tipo_link":"rede_publica"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_links_cadastro WHERE token = 'rede'
);


-- ########## supabase/migrations/20260520140000_hub_leads_crm_codigo_rastreio.sql ##########

-- CÃ³digo Ãºnico de lead (LED-AAAA-####) para rastreio no pipeline comercial.
-- PES- permanece em hub_pessoas (contato); LED identifica a oportunidade no funil.

ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_leads_crm_codigo
  ON public.hub_leads_crm (codigo)
  WHERE codigo IS NOT NULL;

COMMENT ON COLUMN public.hub_leads_crm.codigo IS
  'CÃ³digo de rastreio do lead (ex.: LED-2026-0017). Distinto do cÃ³digo PES da pessoa vinculada.';

-- Backfill para registos antigos (ordem de criaÃ§Ã£o).
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY criado_em NULLS LAST, id) AS rn
  FROM public.hub_leads_crm
  WHERE codigo IS NULL OR TRIM(codigo) = ''
)
UPDATE public.hub_leads_crm l
SET codigo = 'LED-' || TO_CHAR(EXTRACT(YEAR FROM COALESCE(l.criado_em, NOW())), 'FM9999') || '-' || LPAD(n.rn::TEXT, 4, '0')
FROM numbered n
WHERE l.id = n.id;

DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;

CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''::text), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

COMMENT ON VIEW public.vw_hub_leads_crm_enriquecido IS
  'hub_leads_crm.* + pessoa_codigo (PES), email_exibicao, Ãºltima mensagem da fila. l.codigo = LED do lead.';


-- ########## supabase/migrations/20260521130000_hub_pessoas_area_endereco.sql ##########

-- Cadastro CRM: Ã¡rea de atuaÃ§Ã£o e endereÃ§o (CEP / logradouro / bairro) em hub_pessoas.

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS bairro TEXT;

COMMENT ON COLUMN public.hub_pessoas.area_atuacao IS 'Mercado/setor do cliente (value de lib/crm/areas-atuacao.ts).';
COMMENT ON COLUMN public.hub_pessoas.cep IS 'CEP normalizado ou mascarado (8 dÃ­gitos).';
COMMENT ON COLUMN public.hub_pessoas.logradouro IS 'Logradouro (ViaCEP ou manual).';
COMMENT ON COLUMN public.hub_pessoas.bairro IS 'Bairro (ViaCEP ou manual).';


-- ########## supabase/migrations/20260521131000_hub_endereco_numero_complemento.sql ##########

-- NÃºmero e complemento no endereÃ§o (cadastro PF/PJ e empresas).

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS complemento TEXT;

ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS complemento TEXT;

COMMENT ON COLUMN public.hub_pessoas.numero IS 'NÃºmero do imÃ³vel (endereÃ§o).';
COMMENT ON COLUMN public.hub_pessoas.complemento IS 'Complemento (sala, bloco, etc.).';
COMMENT ON COLUMN public.hub_empresas.numero IS 'NÃºmero do imÃ³vel (endereÃ§o).';
COMMENT ON COLUMN public.hub_empresas.complemento IS 'Complemento (sala, bloco, etc.).';


-- ########## supabase/migrations/20260521140000_hub_tenant_obra10_seed.sql ##########

-- Tenant padrÃ£o Obra10 (usado por DEFAULT_TENANT_ID / cadastro CRM).
INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'obra10',
  'Obra10+',
  true
)
ON CONFLICT (id) DO NOTHING;


-- ########## supabase/migrations/20260522120000_ensure_hub_agente_identidade_tenant.sql ##########

-- Garante tenant_id em hub_agente_identidade (PostgREST "schema cache" / bases sem migraÃ§Ã£o 20260509120000).
-- Idempotente. Depois de aplicar: Dashboard â†’ Settings â†’ API â†’ "Reload schema" se o erro persistir.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_agente_identidade
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;


-- ########## supabase/migrations/20260522120000_ensure_hub_negocios.sql ##########

-- Cadastro CRM: hub_negocios (negÃ³cios na gaveta Vendas).
-- lead_id e pessoa_id opcionais para criaÃ§Ã£o manual.

CREATE TABLE IF NOT EXISTS public.hub_negocios (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                      TEXT,
  titulo                      TEXT NOT NULL,
  descricao                   TEXT,
  tipo                        TEXT,
  prefixo_mercado             TEXT NOT NULL,
  lead_id                     UUID,
  pessoa_id                   UUID,
  valor_estimado              NUMERIC(12,2),
  valor_fechado               NUMERIC(12,2),
  percentual_comissao         NUMERIC(5,2) DEFAULT 0,
  comissao_calculada          NUMERIC(12,2),
  status                      TEXT NOT NULL DEFAULT 'aberto',
  etapa                       TEXT NOT NULL DEFAULT 'briefing',
  data_previsao_fechamento    DATE,
  data_fechamento             DATE,
  tenant_id                   UUID,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_negocios_status_chk
    CHECK (status IN ('aberto','em_negociacao','fechado_ganho','fechado_perdido','cancelado')),
  CONSTRAINT hub_negocios_etapa_chk
    CHECK (etapa IN ('briefing','match','sit-down','concluido'))
);

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pessoa_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN lead_id DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'pessoa_id'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN pessoa_id DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hub_negocios_codigo_unique
  ON public.hub_negocios (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE INDEX IF NOT EXISTS idx_hub_negocios_etapa ON public.hub_negocios (etapa);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_status ON public.hub_negocios (status);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);

COMMENT ON TABLE public.hub_negocios IS 'NegÃ³cios/oportunidades do CRM (gaveta Vendas).';


-- ########## supabase/migrations/20260522130000_ensure_hub_leads_crm.sql ##########

-- Tabela hub_leads_crm (pipeline Vendas â†’ Leads).
-- Base: lib/supabase/hub_migration_crm.sql

CREATE TABLE IF NOT EXISTS public.hub_leads_crm (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  telefone            TEXT,
  email               TEXT,
  origem              TEXT CHECK (origem IN ('whatsapp','instagram','meta_ads','google_ads','linkedin','site','indicacao','outro')),
  campanha            TEXT,
  anuncio_id          TEXT,
  estagio             TEXT DEFAULT 'novo' CHECK (estagio IN ('novo','qualificando','qualificado','proposta','negociando','fechamento','ganho','perdido')),
  score               INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  valor_estimado      NUMERIC(12,2) DEFAULT 0,
  agente_responsavel  TEXT,
  humano_responsavel  TEXT,
  proxima_acao        TEXT,
  data_proxima_acao   TIMESTAMPTZ,
  motivo_perda        TEXT,
  tags                TEXT[] DEFAULT '{}',
  metadata            JSONB DEFAULT '{}',
  pessoa_id           UUID,
  tenant_id           UUID,
  ultimo_contato      TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pessoa_id UUID;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS ultimo_contato TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_estagio ON public.hub_leads_crm (estagio);
CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_tenant ON public.hub_leads_crm (tenant_id);

COMMENT ON TABLE public.hub_leads_crm IS 'Leads do CRM operacional (Kanban Vendas).';

CREATE TABLE IF NOT EXISTS public.hub_atividades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  feito_por       TEXT NOT NULL DEFAULT 'humano',
  feito_por_tipo  TEXT NOT NULL DEFAULT 'humano',
  metadata        JSONB DEFAULT '{}',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_atividades_lead ON public.hub_atividades (lead_id, criado_em DESC);


-- ########## supabase/migrations/20260522130100_hub_agent_playbooks_mime_charset.sql ##########

-- Bucket jÃ¡ criado em 20260514130000; alarga MIME permitido por seguranÃ§a (upload API tambÃ©m usa sÃ³ `text/markdown`).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/markdown',
  'text/markdown; charset=utf-8',
  'text/plain',
  'application/octet-stream'
]::text[]
WHERE id = 'hub-agent-playbooks';


-- ########## supabase/migrations/20260522140000_ensure_hub_empresas.sql ##########

-- Cadastro CRM: hub_empresas (gaveta Cadastros â†’ Empresas).

CREATE TABLE IF NOT EXISTS public.hub_empresas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT,
  razao_social      TEXT NOT NULL,
  nome_fantasia     TEXT,
  cnpj              TEXT,
  email             TEXT,
  telefone          TEXT,
  segmento          TEXT,
  prefixo_mercado   TEXT NOT NULL,
  cep               TEXT,
  logradouro        TEXT,
  bairro            TEXT,
  cidade            TEXT,
  estado            TEXT,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  tenant_id         UUID,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS bairro TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hub_empresas_codigo_unique
  ON public.hub_empresas (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE UNIQUE INDEX IF NOT EXISTS hub_empresas_cnpj_unique
  ON public.hub_empresas (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

CREATE INDEX IF NOT EXISTS idx_hub_empresas_ativo ON public.hub_empresas (ativo);
CREATE INDEX IF NOT EXISTS idx_hub_empresas_tenant ON public.hub_empresas (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_empresas_razao ON public.hub_empresas (razao_social);

COMMENT ON TABLE public.hub_empresas IS 'Empresas PJ do CRM (clientes, fornecedores, parceiros).';


-- ########## supabase/migrations/20260522150000_hub_empresas_acesso.sql ##########

-- Controle de acesso da empresa no CRM (habilitado ao cadastrar).

ALTER TABLE public.hub_empresas
  ADD COLUMN IF NOT EXISTS acesso_habilitado BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.hub_empresas
  ADD COLUMN IF NOT EXISTS acesso_habilitado_em TIMESTAMPTZ;

UPDATE public.hub_empresas
SET
  acesso_habilitado = COALESCE(acesso_habilitado, true),
  acesso_habilitado_em = COALESCE(acesso_habilitado_em, criado_em, NOW())
WHERE acesso_habilitado_em IS NULL AND COALESCE(acesso_habilitado, true) = true;

CREATE INDEX IF NOT EXISTS idx_hub_empresas_acesso ON public.hub_empresas (acesso_habilitado);


-- ########## supabase/migrations/20260522180000_hub_tenants_settings.sql ##########

-- ConfiguraÃ§Ãµes por tenant (horÃ¡rio comercial, etc.)
ALTER TABLE public.hub_tenants
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;


-- ########## supabase/migrations/20260522200000_hub_agente_arquivado_em.sql ##########

-- Arquivamento soft de agentes (CRM / Hub).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arquivado_motivo TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.arquivado_em IS
  'Preenchido quando o agente foi arquivado; oculto de listas operacionais.';
COMMENT ON COLUMN public.hub_agente_identidade.arquivado_motivo IS
  'Motivo registado no arquivamento via CRM (mÃ­n. 10 caracteres).';

CREATE INDEX IF NOT EXISTS hub_agente_identidade_arquivado_em_idx
  ON public.hub_agente_identidade (arquivado_em)
  WHERE arquivado_em IS NOT NULL;


-- ########## supabase/migrations/20260522210000_public_users_app_access.sql ##########

-- Utilizadores da aplicaÃ§Ã£o (login CRM): Auth + public.users (role, status).
-- Idempotente: seguro em bases que jÃ¡ tÃªm enums/tabela parciais.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM (
      'owner',
      'admin',
      'vendedor',
      'atendente',
      'parceiro'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.record_status AS ENUM ('Ativo', 'Inativo', 'Arquivado');
  END IF;
END $$;

-- Valores extra em app_role (migraÃ§Ã£o 20260511120000 pode jÃ¡ ter corrido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'owner'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'vendedor',
  status public.record_status NOT NULL DEFAULT 'Ativo',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (lower(trim(email)));

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_service_role_all ON public.users;
CREATE POLICY users_service_role_all ON public.users
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.users IS 'Perfil app: papÃ©is CRM (app_role) ligados a auth.users via auth_id.';


-- ########## supabase/migrations/20260523120000_crm_integral_core.sql ##########

-- CRM Obra10+ integral â€” nÃºcleo comercial, imÃ³veis, KPIs, obras, projetos, financeiro (idempotente).

-- â”€â”€â”€ FunÃ§Ã£o timestamp (reutilizada) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- â”€â”€â”€ Notas, serviÃ§os, propostas, memÃ³rias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  negocio_id UUID,
  conteudo TEXT NOT NULL,
  criado_por TEXT NOT NULL DEFAULT 'humano',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  faixa_preco_min NUMERIC(12,2),
  faixa_preco_max NUMERIC(12,2),
  ativo BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  negocio_id UUID,
  servico_id UUID REFERENCES public.hub_servicos(id),
  titulo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
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
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_memorias_lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  confianca NUMERIC(3,2) DEFAULT 1.0,
  criado_por TEXT DEFAULT 'ia',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â”€â”€â”€ Atividades generalizadas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.hub_atividades ADD COLUMN IF NOT EXISTS negocio_id UUID;
ALTER TABLE public.hub_atividades ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);
ALTER TABLE public.hub_atividades ADD COLUMN IF NOT EXISTS tipo_entidade TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_atividades' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.hub_atividades ALTER COLUMN lead_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hub_atividades_negocio ON public.hub_atividades (negocio_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_propostas_lead ON public.hub_propostas (lead_id);
CREATE INDEX IF NOT EXISTS idx_hub_propostas_negocio ON public.hub_propostas (negocio_id);
CREATE INDEX IF NOT EXISTS idx_hub_notas_lead ON public.hub_notas (lead_id);

-- FK negÃ³cio (apÃ³s hub_negocios existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_atividades_negocio_id_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hub_negocios') THEN
    ALTER TABLE public.hub_atividades
      ADD CONSTRAINT hub_atividades_negocio_id_fkey
      FOREIGN KEY (negocio_id) REFERENCES public.hub_negocios(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_propostas_negocio_id_fkey')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hub_negocios') THEN
    ALTER TABLE public.hub_propostas
      ADD CONSTRAINT hub_propostas_negocio_id_fkey
      FOREIGN KEY (negocio_id) REFERENCES public.hub_negocios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- â”€â”€â”€ ImÃ³veis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('apartamento','casa','terreno','comercial','galpao','outro')),
  finalidade TEXT CHECK (finalidade IN ('venda','locacao','ambos')),
  status TEXT DEFAULT 'captacao' CHECK (status IN ('captacao','disponivel','reservado','vendido','inativo')),
  valor NUMERIC(14,2),
  cidade TEXT,
  estado TEXT,
  bairro TEXT,
  endereco TEXT,
  cep TEXT,
  dormitorios INTEGER,
  banheiros INTEGER,
  vagas INTEGER,
  area_total_m2 NUMERIC(12,2),
  parceiro_id UUID,
  negocio_id UUID,
  ativo BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_imoveis_status ON public.hub_imoveis (status, ativo);
CREATE INDEX IF NOT EXISTS idx_hub_imoveis_tenant ON public.hub_imoveis (tenant_id);

-- â”€â”€â”€ AprovaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('proposta','pedido_material','pagamento','desconto','outro')),
  referencia_id UUID,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada','cancelada')),
  solicitado_por TEXT,
  decidido_por TEXT,
  decidido_em TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_status ON public.hub_aprovacoes (status);

-- â”€â”€â”€ KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_kpis_definicao (
  slug TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT DEFAULT '%',
  direcao TEXT DEFAULT 'maior_melhor' CHECK (direcao IN ('maior_melhor','menor_melhor')),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_kpis_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_slug TEXT NOT NULL REFERENCES public.hub_kpis_definicao(slug),
  agente_slug TEXT,
  valor_meta NUMERIC(12,4) NOT NULL,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_kpis_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_slug TEXT NOT NULL REFERENCES public.hub_kpis_definicao(slug),
  agente_slug TEXT,
  valor_medido NUMERIC(12,4) NOT NULL,
  valor_meta NUMERIC(12,4),
  nivel_alerta TEXT DEFAULT 'ok' CHECK (nivel_alerta IN ('ok','atencao','critico')),
  periodo_inicio TIMESTAMPTZ,
  periodo_fim TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_kpis_resultados_slug ON public.hub_kpis_resultados (kpi_slug, criado_em DESC);

INSERT INTO public.hub_kpis_definicao (slug, nome, descricao, unidade)
VALUES
  ('taxa_qualificacao', 'Taxa de qualificaÃ§Ã£o', '% leads qualificados / total', '%'),
  ('taxa_conversao_negocio', 'ConversÃ£o leadâ†’negÃ³cio', '% leads com negÃ³cio', '%'),
  ('pipeline_aberto', 'Pipeline aberto', 'Soma valor estimado negÃ³cios abertos', 'BRL'),
  ('leads_hoje', 'Leads hoje', 'Leads criados no dia', 'un'),
  ('aprovacoes_pendentes', 'AprovaÃ§Ãµes pendentes', 'DecisÃµes aguardando', 'un')
ON CONFLICT (slug) DO NOTHING;

-- â”€â”€â”€ Obras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  negocio_id UUID,
  imovel_id UUID REFERENCES public.hub_imoveis(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planejamento' CHECK (status IN ('planejamento','em_andamento','pausada','concluida','cancelada')),
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  data_inicio DATE,
  data_previsao_fim DATE,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_obras_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  fase TEXT NOT NULL,
  percentual NUMERIC(5,2) DEFAULT 0,
  data_prevista DATE,
  concluida BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_obras_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  resumo TEXT NOT NULL,
  clima TEXT,
  registrado_por TEXT,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_operarios_checkin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  pessoa_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('chegada','saida')),
  origem TEXT DEFAULT 'whatsapp',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_obras_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  legenda TEXT,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_obras_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  severidade TEXT DEFAULT 'info' CHECK (severidade IN ('info','atencao','critico')),
  descricao TEXT NOT NULL,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_pedidos_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  obra_id UUID REFERENCES public.hub_obras(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','cotando','aprovado','entregue','cancelado')),
  valor_estimado NUMERIC(12,2),
  solicitado_por TEXT,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â”€â”€â”€ Projetos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  negocio_id UUID,
  obra_id UUID REFERENCES public.hub_obras(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'briefing' CHECK (status IN ('briefing','desenvolvimento','aprovacao_cliente','concluido','cancelado')),
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_projetos_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.hub_projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â”€â”€â”€ Financeiro (mÃ­nimo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  fornecedor_empresa_id UUID,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
  negocio_id UUID,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS empresa_id UUID;

-- Triggers
DROP TRIGGER IF EXISTS hub_imoveis_ts ON public.hub_imoveis;
CREATE TRIGGER hub_imoveis_ts BEFORE UPDATE ON public.hub_imoveis
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

DROP TRIGGER IF EXISTS hub_propostas_ts ON public.hub_propostas;
CREATE TRIGGER hub_propostas_ts BEFORE UPDATE ON public.hub_propostas
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

-- Helpers RLS (se migraÃ§Ã£o 20260510130000 ainda nÃ£o aplicada no remoto)
CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.default_obra10_tenant_id() TO anon, authenticated;

-- RLS piloto (service_role ignora; anon = tenant legado)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hub_notas','hub_servicos','hub_propostas','hub_memorias_lead',
    'hub_imoveis','hub_aprovacoes','hub_kpis_resultados','hub_kpis_metas',
    'hub_obras','hub_pedidos_material','hub_projetos',
    'hub_contas_pagar','hub_contas_receber','hub_atividades'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_anon ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_anon ON public.%I FOR ALL TO anon USING (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id()) WITH CHECK (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id())',
      t, t
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.hub_imoveis IS 'CatÃ¡logo de imÃ³veis (Produtos â†’ ImÃ³veis).';
COMMENT ON TABLE public.hub_obras IS 'ExecuÃ§Ã£o de obra vinculada a negÃ³cio/imÃ³vel.';


-- ########## supabase/migrations/20260523120000_hub_delete_agente_cascade_rpc.sql ##########

-- ExclusÃ£o em cascata de um agente com SET LOCAL app.delete_authorized = true
-- na mesma transaÃ§Ã£o (obrigatÃ³rio quando existe trigger block_unauthorized_delete).
-- Chamada via PostgREST: rpc('hub_delete_agente_cascade', { p_agente_slug: '...' }).

CREATE OR REPLACE FUNCTION public.hub_delete_agente_cascade(p_agente_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_agente_slug IS NULL OR length(trim(p_agente_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agente_slug invÃ¡lido');
  END IF;

  SET LOCAL app.delete_authorized = true;

  SELECT id INTO v_id
  FROM hub_agente_identidade
  WHERE agente_slug = p_agente_slug
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agente nÃ£o encontrado');
  END IF;

  DELETE FROM hub_ciclos_log
  WHERE agente_slug = p_agente_slug
     OR ciclo_id IN (SELECT id FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug);

  DELETE FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug;

  UPDATE hub_leads_crm SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;
  UPDATE hub_fila_mensagens SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;

  DELETE FROM hub_ml_historico WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_ml_sugestoes
  WHERE agente_slug = p_agente_slug OR supervisor_slug = p_agente_slug;
  DELETE FROM hub_ml_observacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_responsabilidades
  WHERE supervisor_slug = p_agente_slug OR subordinado_slug = p_agente_slug;

  DELETE FROM hub_kpis_resultados WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_kpis_metas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_acoes_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_qualidade_agente WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_aprovacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_alertas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_regras_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_conhecimento WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_personalidade WHERE agente_slug = p_agente_slug;

  UPDATE hub_arquivos SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
  UPDATE hub_conversas_log SET agente_slug = NULL WHERE agente_slug = p_agente_slug;
  UPDATE hub_prompt_logs SET agente_slug = NULL WHERE agente_slug = p_agente_slug;

  DELETE FROM hub_crm_agente_briefing_sessao WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_autonomia_matriz WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_configuracao WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_scripts WHERE agente_id = v_id;
  DELETE FROM hub_regras_negocio WHERE agente_id = v_id;
  DELETE FROM hub_ml_padroes WHERE agente_id = v_id;

  DELETE FROM hub_agente_identidade WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_agente_cascade(text) IS
  'Apaga um agente e satÃ©lites; usa SET LOCAL app.delete_authorized = true (trigger delete).';

REVOKE ALL ON FUNCTION public.hub_delete_agente_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_agente_cascade(text) TO service_role;


-- ########## supabase/migrations/20260523150000_crm_rls_extended.sql ##########

-- RLS estendido: negÃ³cios, empresas, pessoas (Fase E multi-tenant)

CREATE OR REPLACE FUNCTION public.app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(COALESCE(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')),
    ''
  )::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.app_tenant_id() TO anon, authenticated;

ALTER TABLE public.hub_negocios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_negocios_anon ON public.hub_negocios;
CREATE POLICY hub_negocios_anon ON public.hub_negocios
  FOR ALL TO anon
  USING (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id());

ALTER TABLE public.hub_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_empresas_anon ON public.hub_empresas;
CREATE POLICY hub_empresas_anon ON public.hub_empresas
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.hub_pessoas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_pessoas_anon ON public.hub_pessoas;
CREATE POLICY hub_pessoas_anon ON public.hub_pessoas
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.hub_obras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obras_auth ON public.hub_obras;
CREATE POLICY hub_obras_auth ON public.hub_obras
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND (tenant_id IS NULL OR tenant_id = app_tenant_id()))
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());


-- ########## supabase/migrations/20260523170000_obra10_runtime_essencial.sql ##########

-- OBRA10: tabelas mÃ­nimas para CRM + atendimento + dashboard (idempotente).

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;

-- â”€â”€â”€ Agentes IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_agente_identidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  system_prompt_base TEXT NOT NULL DEFAULT '',
  modelo_padrao TEXT DEFAULT 'haiku',
  ativo BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.hub_agente_identidade (agente_slug, nome, system_prompt_base, ativo, tenant_id)
VALUES
  ('sdr', 'SDR Comercial', 'Atendimento comercial Obra10+.', true, public.default_obra10_tenant_id()),
  ('wendel', 'Operador CRM', 'Suporte humano no CRM.', true, public.default_obra10_tenant_id())
ON CONFLICT (agente_slug) DO NOTHING;

-- â”€â”€â”€ Fila WhatsApp / CRM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_fila_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  conversa_id UUID,
  agente_id TEXT,
  agente_responsavel TEXT,
  canal TEXT DEFAULT 'whatsapp',
  direcao TEXT NOT NULL DEFAULT 'entrada' CHECK (direcao IN ('entrada','saida')),
  conteudo TEXT,
  status TEXT DEFAULT 'pendente',
  metadata JSONB DEFAULT '{}',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  enviada_em TIMESTAMPTZ,
  resposta_enviada BOOLEAN DEFAULT false,
  agendado_para TIMESTAMPTZ,
  remetente_numero TEXT,
  whatsapp_message_id TEXT,
  tentativas INTEGER DEFAULT 0,
  processado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.hub_leads_crm') IS NOT NULL THEN
    ALTER TABLE public.hub_fila_mensagens DROP CONSTRAINT IF EXISTS hub_fila_mensagens_lead_id_fkey;
    ALTER TABLE public.hub_fila_mensagens
      ADD CONSTRAINT hub_fila_mensagens_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fila lead fk: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_hub_fila_lead_criado ON public.hub_fila_mensagens (lead_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_fila_status_dir ON public.hub_fila_mensagens (status, direcao);

ALTER TABLE public.hub_fila_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_fila_mensagens_anon ON public.hub_fila_mensagens;
CREATE POLICY hub_fila_mensagens_anon ON public.hub_fila_mensagens
  FOR ALL TO anon
  USING (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id());

-- â”€â”€â”€ AprovaÃ§Ãµes (schema operacional IA + UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS agente_slug TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS agente_nome TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS impacto TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS recomendacao TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS confianca_ia NUMERIC(5,2) DEFAULT 85;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS valor_envolvido NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS dados JSONB DEFAULT '{}';
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS aprovado_por TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS rejeitado_por TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS observacao TEXT;

UPDATE public.hub_aprovacoes
SET
  descricao = COALESCE(NULLIF(TRIM(descricao), ''), titulo, 'AprovaÃ§Ã£o'),
  agente_slug = COALESCE(agente_slug, solicitado_por, 'sdr'),
  motivo = COALESCE(motivo, descricao)
WHERE titulo IS NOT NULL OR descricao IS NOT NULL;

ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT IF EXISTS hub_aprovacoes_status_check;
ALTER TABLE public.hub_aprovacoes
  ADD CONSTRAINT hub_aprovacoes_status_check
  CHECK (status IN ('pendente','aprovado','rejeitado','aprovada','rejeitada','cancelada'));

UPDATE public.hub_aprovacoes SET status = 'aprovado' WHERE status = 'aprovada';
UPDATE public.hub_aprovacoes SET status = 'rejeitado' WHERE status = 'rejeitada';

-- â”€â”€â”€ Parceiros (mÃ­nimo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  cnpj TEXT,
  especialidade TEXT,
  mercado TEXT,
  cidade TEXT,
  estado TEXT,
  status TEXT DEFAULT 'captacao',
  modulo_atual INTEGER DEFAULT 1,
  recebe_leads BOOLEAN DEFAULT false,
  total_leads_recebidos INTEGER DEFAULT 0,
  total_leads_convertidos INTEGER DEFAULT 0,
  comissao_pct NUMERIC(5,2) DEFAULT 5,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_captacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  estagio TEXT DEFAULT 'interessado',
  origem TEXT,
  canal TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_homologacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  estagio TEXT DEFAULT 'em_andamento',
  modulos_concluidos INTEGER DEFAULT 0,
  data_conclusao TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  modulo_numero INTEGER NOT NULL,
  status TEXT DEFAULT 'pendente',
  concluido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_parceiros_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.hub_parceiros(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT,
  feito_por TEXT DEFAULT 'sistema',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  status TEXT DEFAULT 'ativo',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_encaminhamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  encaminhado_para TEXT,
  encaminhado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID REFERENCES public.hub_tenants(id)
);

CREATE TABLE IF NOT EXISTS public.hub_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT,
  tipo TEXT,
  descricao TEXT,
  lead_id UUID,
  valor_envolvido NUMERIC(12,2),
  aprovado_por TEXT,
  resultado TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT,
  tipo TEXT DEFAULT 'info',
  titulo TEXT NOT NULL,
  descricao TEXT,
  lido BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View leads enriquecida
DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;
CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

GRANT SELECT ON public.vw_hub_leads_crm_enriquecido TO anon, authenticated;


-- ########## supabase/migrations/20260524120000_analytics_metas_seed.sql ##########

-- Analytics: KPI fila + metas por agente (doc mestre Â§6.1.7)

INSERT INTO public.hub_kpis_definicao (slug, nome, descricao, unidade)
VALUES
  ('mensagens_fila_pendentes', 'Mensagens na fila', 'Entrada pendente em hub_fila_mensagens', 'un')
ON CONFLICT (slug) DO NOTHING;

DO $$
BEGIN
  ALTER TABLE public.hub_kpis_metas
    ADD CONSTRAINT hub_kpis_metas_slug_agente_key UNIQUE (kpi_slug, agente_slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.hub_kpis_metas (kpi_slug, agente_slug, valor_meta, tenant_id)
VALUES
  ('taxa_qualificacao', 'sdr', 40, default_obra10_tenant_id()),
  ('taxa_qualificacao', 'atendente', 35, default_obra10_tenant_id()),
  ('taxa_conversao_negocio', 'gerente_atendimento', 15, default_obra10_tenant_id()),
  ('mensagens_fila_pendentes', 'atendente', 10, default_obra10_tenant_id()),
  ('mensagens_fila_pendentes', 'gerente_atendimento', 5, default_obra10_tenant_id()),
  ('aprovacoes_pendentes', 'diretor_geral_ia', 5, default_obra10_tenant_id())
ON CONFLICT (kpi_slug, agente_slug) DO NOTHING;


-- ########## supabase/migrations/20260524120000_hub_delete_ciclo_cascade_rpc.sql ##########

-- ExclusÃ£o em cascata de um ciclo: hub_ciclos_log (ciclo_id) + hub_ciclos_ia,
-- com SET LOCAL app.delete_authorized = true quando existir trigger de bloqueio.

CREATE OR REPLACE FUNCTION public.hub_delete_ciclo_cascade(p_ciclo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ciclo_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ciclo_id invÃ¡lido');
  END IF;

  SET LOCAL app.delete_authorized = true;

  IF NOT EXISTS (SELECT 1 FROM hub_ciclos_ia WHERE id = p_ciclo_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ciclo nÃ£o encontrado');
  END IF;

  DELETE FROM hub_ciclos_log WHERE ciclo_id = p_ciclo_id;
  DELETE FROM hub_ciclos_ia WHERE id = p_ciclo_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_ciclo_cascade(uuid) IS
  'Apaga hub_ciclos_log do ciclo e a linha em hub_ciclos_ia; respeita app.delete_authorized.';

REVOKE ALL ON FUNCTION public.hub_delete_ciclo_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_ciclo_cascade(uuid) TO service_role;


-- ########## supabase/migrations/20260525120000_hub_agente_conhecimento_fluxo_sdr.sql ##########

-- Permite secÃ§Ã£o POP / fluxo operacional (id tÃ©cnico fluxo_sdr) em hub_agente_conhecimento.secao
ALTER TABLE public.hub_agente_conhecimento
  DROP CONSTRAINT IF EXISTS hub_agente_conhecimento_secao_check;

ALTER TABLE public.hub_agente_conhecimento
  ADD CONSTRAINT hub_agente_conhecimento_secao_check
  CHECK (
    secao IN (
      'empresa',
      'servicos',
      'atendimento',
      'proibicoes',
      'exemplos',
      'objeccoes',
      'fluxo_sdr'
    )
  );


-- ########## supabase/migrations/20260526120000_hub_briefing_sessao_modo.sql ##########

-- Modo por sessÃ£o: revisÃ£o interna (operacional) vs simulaÃ§Ã£o como no canal ao vivo.
ALTER TABLE public.hub_crm_agente_briefing_sessao
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'briefing_interno';

COMMENT ON COLUMN public.hub_crm_agente_briefing_sessao.modo IS
  'briefing_interno = snapshot ciclos/logs; simulacao_canal = prompt builder de produÃ§Ã£o (teste playbook).';


-- ########## supabase/migrations/20260527120000_vitual_relatorios_storage_bucket.sql ##########

-- RelatÃ³rios Markdown do agente Vitual (agents/run.py) â†’ Supabase Storage.
-- Upload via API: POST .../storage/v1/object/vitual-relatorios/...
-- RecomendaÃ§Ã£o: usar SUPABASE_SERVICE_ROLE_KEY no agente (contorna RLS de storage).
-- Opcional: defina o bucket como public no dashboard se quiseres URLs pÃºblicas sem token.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vitual-relatorios',
  'vitual-relatorios',
  false,
  10485760,
  ARRAY[
    'text/markdown',
    'text/markdown; charset=utf-8',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ########## supabase/migrations/20260528120000_hub_agente_modo_operacao.sql ##########

-- Modo de operaÃ§Ã£o do agente: atendimento WhatsApp (webhook) vs jobs internos (ciclos/cron).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS modo_operacao text,
  ADD COLUMN IF NOT EXISTS ciclo_execucao_padrao text;

COMMENT ON COLUMN public.hub_agente_identidade.modo_operacao IS
  'canal_whatsapp = atendimento UAZAPI/webhook; jobs_internos = ciclos cron/dispatch.';
COMMENT ON COLUMN public.hub_agente_identidade.ciclo_execucao_padrao IS
  'interacao | tempo_real | agenda â€” escolha no wizard ao criar agente.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_agente_identidade_modo_operacao_check'
  ) THEN
    ALTER TABLE public.hub_agente_identidade
      ADD CONSTRAINT hub_agente_identidade_modo_operacao_check
      CHECK (modo_operacao IS NULL OR modo_operacao IN ('canal_whatsapp', 'jobs_internos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_agente_identidade_ciclo_execucao_padrao_check'
  ) THEN
    ALTER TABLE public.hub_agente_identidade
      ADD CONSTRAINT hub_agente_identidade_ciclo_execucao_padrao_check
      CHECK (
        ciclo_execucao_padrao IS NULL
        OR ciclo_execucao_padrao IN ('interacao', 'tempo_real', 'agenda')
      );
  END IF;
END $$;

-- Backfill a partir do ciclo padrÃ£o provisionado no wizard (se existir).
-- Nota: em UPDATE ... FROM o Postgres nÃ£o deixa correlacionar a tabela alvo (h) dentro de um
-- subquery no FROM; por isso usamos uma subconsulta derivada por agente_slug.
UPDATE public.hub_agente_identidade h
SET
  ciclo_execucao_padrao = CASE c.tipo
    WHEN 'gatilho' THEN 'interacao'
    WHEN 'continuo' THEN 'tempo_real'
    WHEN 'programado' THEN 'agenda'
    ELSE NULL
  END,
  modo_operacao = CASE c.tipo
    WHEN 'gatilho' THEN 'canal_whatsapp'
    WHEN 'continuo' THEN 'jobs_internos'
    WHEN 'programado' THEN 'jobs_internos'
    ELSE NULL
  END
FROM (
  SELECT DISTINCT ON (c2.agente_slug)
    c2.agente_slug,
    c2.tipo
  FROM public.hub_ciclos_ia c2
  WHERE (c2.configuracoes->>'ciclo_origem_provisionamento') = 'wizard_agente_v1'
  ORDER BY c2.agente_slug, c2.id
) c
WHERE h.agente_slug = c.agente_slug
  AND h.modo_operacao IS NULL
  AND c.tipo IS NOT NULL;


-- ########## supabase/migrations/20260528120000_hub_crm_pdf_refinamento.sql ##########

-- CRM PDF: colunas aditivas, logs, encaminhamento V2, vÃ­nculos pessoaâ€“empresa.

CREATE TABLE IF NOT EXISTS public.hub_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  motivo TEXT,
  usuario_id UUID,
  origem TEXT DEFAULT 'crm',
  tenant_id UUID REFERENCES public.hub_tenants(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_logs_entidade ON public.hub_logs (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_hub_logs_criado ON public.hub_logs (criado_em DESC);

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS estagio_funil TEXT;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS tipo_interesse TEXT;
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS proxima_acao TEXT;

ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS negocio_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS destinatario_pessoa_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS destinatario_empresa_id UUID;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS responsavel_envio TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS sugerido_ia BOOLEAN DEFAULT false;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS validado_humano BOOLEAN DEFAULT false;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aguardando_validacao';
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS criterio_selecao TEXT;
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hub_encaminhamentos ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.hub_proximas_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  data_prevista TIMESTAMPTZ,
  responsavel_id UUID,
  concluida BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_pessoas_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES public.hub_pessoas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.hub_empresas(id) ON DELETE CASCADE,
  cargo TEXT,
  principal BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pessoa_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_pessoas_empresas_pessoa ON public.hub_pessoas_empresas (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_hub_pessoas_empresas_empresa ON public.hub_pessoas_empresas (empresa_id);


-- ########## supabase/migrations/20260529200000_ensure_tenant_id_crm_relatorios.sql ##########

-- Garante tenant_id em tabelas usadas por /crm/relatorios e RLS multi-tenant.
-- Idempotente: seguro em projetos onde CREATE TABLE antigo nÃ£o incluÃ­a a coluna.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

DO $$
DECLARE
  t uuid := public.default_obra10_tenant_id();
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_negocios') THEN
    ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_negocios SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_empresas') THEN
    ALTER TABLE public.hub_empresas ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_empresas SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_empresas_tenant ON public.hub_empresas (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_imoveis') THEN
    ALTER TABLE public.hub_imoveis ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_imoveis SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_imoveis_tenant ON public.hub_imoveis (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar') THEN
    ALTER TABLE public.hub_contas_pagar ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_contas_pagar SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_contas_pagar_tenant ON public.hub_contas_pagar (tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_receber') THEN
    ALTER TABLE public.hub_contas_receber ADD COLUMN IF NOT EXISTS tenant_id UUID;
    UPDATE public.hub_contas_receber SET tenant_id = t WHERE tenant_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_tenant ON public.hub_contas_receber (tenant_id);
  END IF;
END $$;

-- FK opcional (sÃ³ se hub_tenants existir e constraint ainda nÃ£o existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_negocios_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_negocios
      ADD CONSTRAINT hub_negocios_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_empresas_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_empresas' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_empresas
      ADD CONSTRAINT hub_empresas_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_imoveis_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_imoveis' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_imoveis
      ADD CONSTRAINT hub_imoveis_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_contas_pagar_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_contas_pagar
      ADD CONSTRAINT hub_contas_pagar_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hub_contas_receber_tenant_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_contas_receber' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.hub_contas_receber
      ADD CONSTRAINT hub_contas_receber_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'FK tenant_id: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.hub_negocios.tenant_id IS 'Tenant Obra10+ (multi-tenant).';


-- ########## supabase/migrations/20260529210000_ensure_hub_financeiro_tables.sql ##########

-- Tabelas financeiras mÃ­nimas para /crm/relatorios (quando 20260523120000 nÃ£o foi aplicada).

CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.hub_contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  fornecedor_empresa_id UUID,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  vencimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  negocio_id UUID,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS hub_contas_pagar_ts ON public.hub_contas_pagar;
CREATE TRIGGER hub_contas_pagar_ts
  BEFORE UPDATE ON public.hub_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

DROP TRIGGER IF EXISTS hub_contas_receber_ts ON public.hub_contas_receber;
CREATE TRIGGER hub_contas_receber_ts
  BEFORE UPDATE ON public.hub_contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

CREATE INDEX IF NOT EXISTS idx_hub_contas_pagar_venc ON public.hub_contas_pagar (vencimento);
CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_venc ON public.hub_contas_receber (vencimento);

ALTER TABLE public.hub_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_contas_pagar_service ON public.hub_contas_pagar;
CREATE POLICY hub_contas_pagar_service ON public.hub_contas_pagar FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_contas_receber_service ON public.hub_contas_receber;
CREATE POLICY hub_contas_receber_service ON public.hub_contas_receber FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.hub_contas_pagar TO anon, authenticated, service_role;
GRANT ALL ON public.hub_contas_receber TO anon, authenticated, service_role;


-- ########## supabase/migrations/20260531120000_hub_agente_uazapi_instance.sql ##########

-- LigaÃ§Ã£o agente CRM â†” instÃ¢ncia UAZAPI (um nÃºmero WhatsApp por agente quando configurado).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_token TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_name TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_connection_status TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_id IS 'ID da instÃ¢ncia na UAZAPI (correlaciona webhook global).';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_token IS 'Token da instÃ¢ncia (header token); nÃ£o expor ao cliente.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_name IS 'Nome amigÃ¡vel na UAZAPI.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_connection_status IS 'disconnected | connecting | connected (espelho operacional).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_agente_uazapi_instance_id
  ON public.hub_agente_identidade (uazapi_instance_id)
  WHERE uazapi_instance_id IS NOT NULL AND trim(uazapi_instance_id) <> '';


-- ########## supabase/migrations/20260601120000_hub_delete_cargo_catalogo_rpc.sql ##########

-- Elimina uma linha de hub_cargos_catalogo na mesma transaÃ§Ã£o que
-- SET LOCAL app.delete_authorized = true (obrigatÃ³rio com trigger block_unauthorized_delete).

CREATE OR REPLACE FUNCTION public.hub_delete_cargo_catalogo(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := trim(both from COALESCE(p_slug, ''));
  v_titulo text;
  v_count int;
BEGIN
  IF length(v_slug) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'slug invÃ¡lido');
  END IF;

  SELECT trim(both from COALESCE(titulo::text, ''))
  INTO v_titulo
  FROM hub_cargos_catalogo
  WHERE slug = v_slug;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cargo nÃ£o encontrado.');
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM hub_agente_identidade WHERE cargo = v_titulo;

  IF COALESCE(v_count, 0) > 0 THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      format(
        'NÃ£o Ã© possÃ­vel eliminar: %s agente(s) usam o cargo Â«%sÂ». Desactive o cargo ou actualize os agentes.',
        v_count,
        v_titulo
      )
    );
  END IF;

  SET LOCAL app.delete_authorized = true;

  DELETE FROM hub_cargos_catalogo WHERE slug = v_slug;

  RETURN jsonb_build_object('ok', true, 'slug', v_slug);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_cargo_catalogo(text) IS
  'Apaga cargo do catÃ¡logo apÃ³s validar uso por agentes; usa SET LOCAL app.delete_authorized = true.';

REVOKE ALL ON FUNCTION public.hub_delete_cargo_catalogo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_cargo_catalogo(text) TO service_role;


-- ########## supabase/migrations/20260601180000_hub_agente_playbook_only_cargo.sql ##########

-- Agentes Â«sÃ³ playbookÂ» (area = playbook, sem linha em hub_cargos_catalogo).

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS instrucao_modo TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.instrucao_modo IS
  'playbook_only | cargo_catalogo â€” origem das instruÃ§Ãµes estÃ¡ticas do agente.';

UPDATE public.hub_agente_identidade
SET instrucao_modo = 'playbook_only'
WHERE instrucao_modo IS NULL
  AND COALESCE(area, '') = 'playbook'
  AND (cargo IS NULL OR btrim(cargo) = '');

-- Remove triggers antigos de validaÃ§Ã£o de cargo (nomes variam por ambiente).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'hub_agente_identidade'
      AND NOT t.tgisinternal
      AND (
        t.tgname ILIKE '%cargo%'
        OR t.tgname ILIKE '%validar%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.hub_agente_identidade', r.tgname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.hub_agente_identidade_validar_cargo_catalogo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cargo text;
BEGIN
  -- Playbook-only: nÃ£o validar catÃ¡logo (cargo Ã© rÃ³tulo fixo, nÃ£o hub_cargos_catalogo).
  IF COALESCE(NEW.instrucao_modo, '') IN ('playbook_only', 'playbook-only')
     OR COALESCE(NEW.area, '') = 'playbook' THEN
    RETURN NEW;
  END IF;

  v_cargo := NULLIF(btrim(COALESCE(NEW.cargo, '')), '');

  IF v_cargo IS NULL THEN
    RAISE EXCEPTION
      'Cargo % nao existe no catalogo ativo. Use apenas cargos ativos de hub_cargos_catalogo.',
      '<NULL>';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.hub_cargos_catalogo c
    WHERE c.ativo IS TRUE
      AND c.titulo = v_cargo
  ) THEN
    RAISE EXCEPTION
      'Cargo % nao existe no catalogo ativo. Use apenas cargos ativos de hub_cargos_catalogo.',
      v_cargo;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.hub_agente_identidade_validar_cargo_catalogo() IS
  'Valida hub_agente_identidade.cargo contra hub_cargos_catalogo; ignora agentes playbook-only (area/instrucao_modo).';

DROP TRIGGER IF EXISTS trg_hub_agente_identidade_validar_cargo ON public.hub_agente_identidade;
DROP TRIGGER IF EXISTS trg_hub_agente_validar_cargo ON public.hub_agente_identidade;
DROP TRIGGER IF EXISTS hub_agente_identidade_validar_cargo ON public.hub_agente_identidade;

CREATE TRIGGER trg_hub_agente_identidade_validar_cargo
  BEFORE INSERT OR UPDATE OF cargo, area, instrucao_modo
  ON public.hub_agente_identidade
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_agente_identidade_validar_cargo_catalogo();


-- ########## supabase/migrations/20260602120000_hub_agente_identidade_chk_modelo_valido.sql ##########

-- Alinha chk_modelo_valido com o Hub Mistral-first (lib/ia/hub-model-defaults.ts):
-- sentinel `mistral`, atalhos legados haiku|sonnet|opus, famÃ­lia Mistral (*mistral-*, ministral*, etc.),
-- e IDs Anthropic (`claude-*`). Corrige linhas antigas antes de recriar o CHECK.

CREATE OR REPLACE FUNCTION public.hub_agente_modelo_id_valido(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    p IS NOT NULL
    AND length(btrim(p)) > 0
    AND (
      lower(btrim(p)) = 'mistral'
      OR lower(btrim(p)) IN ('haiku', 'sonnet', 'opus')
      OR btrim(p) ~* '^claude-'
      OR btrim(p) ~* '^mistral-'
      OR btrim(p) ~* '^ministral'
      OR btrim(p) ~* '^open-mixtral'
      OR btrim(p) ~* '^pixtral'
      OR btrim(p) ~* '^codestral'
    );
$$;

COMMENT ON FUNCTION public.hub_agente_modelo_id_valido(text) IS
  'Valida modelo_padrao / modelo_critico / modelo_alto_valor em hub_agente_identidade (Mistral sentinel, legados curtos, famÃ­lia Mistral, claude-*).';

UPDATE public.hub_agente_identidade h
SET
  modelo_padrao = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_padrao) THEN h.modelo_padrao
    ELSE 'mistral'
  END,
  modelo_critico = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_critico) THEN h.modelo_critico
    ELSE 'mistral'
  END,
  modelo_alto_valor = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_alto_valor) THEN h.modelo_alto_valor
    ELSE 'mistral'
  END
WHERE
  NOT public.hub_agente_modelo_id_valido(h.modelo_padrao)
  OR NOT public.hub_agente_modelo_id_valido(h.modelo_critico)
  OR NOT public.hub_agente_modelo_id_valido(h.modelo_alto_valor);

ALTER TABLE public.hub_agente_identidade
  DROP CONSTRAINT IF EXISTS chk_modelo_valido;

ALTER TABLE public.hub_agente_identidade
  ADD CONSTRAINT chk_modelo_valido CHECK (
    public.hub_agente_modelo_id_valido(modelo_padrao)
    AND public.hub_agente_modelo_id_valido(modelo_critico)
    AND public.hub_agente_modelo_id_valido(modelo_alto_valor)
  );


-- ########## supabase/migrations/20260603120000_hub_ferramentas_custom.sql ##########

-- Ferramentas Hub customizÃ¡veis por tenant (wrapper sobre builtins + smart layer opcional).

CREATE TABLE IF NOT EXISTS public.hub_ferramentas_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  ferramenta_key text NOT NULL,
  titulo text NOT NULL,
  descricao_modelo text NOT NULL,
  builtin_impl text NOT NULL,
  parametros_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  smart_provider text NOT NULL DEFAULT 'none' CHECK (smart_provider IN ('none', 'mistral', 'gemini')),
  smart_model text,
  smart_prompt text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_ferramentas_custom_key_unique UNIQUE (tenant_id, ferramenta_key),
  CONSTRAINT hub_ferramentas_custom_key_format CHECK (ferramenta_key ~ '^hub_custom_[a-z0-9_]{1,48}$')
);

CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant ON public.hub_ferramentas_custom (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant_ativo ON public.hub_ferramentas_custom (tenant_id, ativo);

COMMENT ON TABLE public.hub_ferramentas_custom IS
  'Ferramentas Mistral por tenant: nome/descriÃ§Ã£o prÃ³prios, mesma execuÃ§Ã£o que um builtin; smart layer opcional (Mistral/Gemini).';


-- ########## supabase/migrations/20260603130000_hub_ferramentas_custom_descricao_curta.sql ##########

-- Coluna usada pelo CRM/API para notas administrativas (alinhamento com POST/PATCH e drawer).

ALTER TABLE public.hub_ferramentas_custom
  ADD COLUMN IF NOT EXISTS descricao_curta text;

COMMENT ON COLUMN public.hub_ferramentas_custom.descricao_curta IS
  'DescriÃ§Ã£o curta visÃ­vel no CRM (admin); distinta da descriÃ§Ã£o exposta ao modelo (descricao_modelo).';


-- ########## supabase/migrations/20260604120000_hub_ferramentas_custom_descricao_curta.sql ##########

-- DescriÃ§Ã£o curta para equipa / UI (opcional). A descriÃ§Ã£o longa para o modelo permanece em descricao_modelo.

ALTER TABLE public.hub_ferramentas_custom
  ADD COLUMN IF NOT EXISTS descricao_curta text;

COMMENT ON COLUMN public.hub_ferramentas_custom.descricao_curta IS
  'Resumo legÃ­vel para administradores; descricao_modelo Ã© o texto exposto ao Mistral na function.';


-- ########## supabase/migrations/20260604120000_hub_memorias_lead_fk_crm.sql ##########

-- Alinha hub_memorias_lead.lead_id com hub_leads_crm (webhook WhatsApp usa hub_leads_crm.id).
-- Se existirem linhas Ã³rfÃ£s (lead_id sÃ³ em hub_leads), corra antes: scripts/verify-hub-memorias-lead-fk.cjs

ALTER TABLE public.hub_memorias_lead
  DROP CONSTRAINT IF EXISTS hub_memorias_lead_lead_id_fkey;

-- Garante colunas chave/valor se a BD tiver sÃ³ o schema legado (hub_migration_v2)
ALTER TABLE public.hub_memorias_lead
  ADD COLUMN IF NOT EXISTS chave TEXT,
  ADD COLUMN IF NOT EXISTS valor TEXT,
  ADD COLUMN IF NOT EXISTS confianca NUMERIC(3, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS criado_por TEXT DEFAULT 'ia',
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hub_memorias_lead_lead_id_fkey'
      AND conrelid = 'public.hub_memorias_lead'::regclass
  ) THEN
    ALTER TABLE public.hub_memorias_lead
      ADD CONSTRAINT hub_memorias_lead_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm (id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON CONSTRAINT hub_memorias_lead_lead_id_fkey ON public.hub_memorias_lead IS
  'MemÃ³rias do lead no CRM WhatsApp (hub_leads_crm), nÃ£o hub_leads canvas.';


-- ########## supabase/migrations/20260605120000_ensure_hub_leads_crm_tenant.sql ##########

-- Corrige: "Could not find the 'tenant_id' column of 'hub_leads_crm' in the schema cache"
-- quando o projeto Supabase nÃ£o executou ainda 20260509120000_hub_ciclos_slugs_e_tenants.sql.
-- Idempotente: seguro correr vÃ¡rias vezes.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.hub_leads_crm
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_leads_crm
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_leads_crm_tenant ON public.hub_leads_crm(tenant_id);

-- ApÃ³s correr: no Dashboard Supabase â†’ Project Settings â†’ API â†’ "Reload schema" se o erro de cache persistir.


-- ########## supabase/migrations/20260606120000_hub_agente_rag_pgvector.sql ##########

-- RAG por agente: documentos no Storage + chunks com embeddings Mistral em pgvector.
-- Aplicar antes de usar a UI de upload no wizard.

CREATE EXTENSION IF NOT EXISTS vector;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-agent-rag-docs',
  'hub-agent-rag-docs',
  false,
  5242880,
  ARRAY[
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/pdf',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.hub_agente_rag_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.hub_tenants(id),
  agente_slug TEXT NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'hub-agent-rag-docs',
  object_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexando',
  chunks_count INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexado_em TIMESTAMPTZ,
  UNIQUE (bucket_id, object_path),
  CONSTRAINT hub_agente_rag_documentos_status_chk
    CHECK (status IN ('indexando', 'pronto', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_documentos_agente
  ON public.hub_agente_rag_documentos (agente_slug, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.hub_agente_rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.hub_agente_rag_documentos(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  agente_slug TEXT NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_chunks_agente
  ON public.hub_agente_rag_chunks (agente_slug, document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_chunks_embedding_hnsw
  ON public.hub_agente_rag_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_hub_agente_rag_chunks(
  p_agente_slug TEXT,
  p_query_embedding vector(1024),
  p_match_count INTEGER DEFAULT 5,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.68
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  agente_slug TEXT,
  nome_arquivo TEXT,
  conteudo TEXT,
  similarity DOUBLE PRECISION,
  chunk_index INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.agente_slug,
    d.nome_arquivo,
    c.conteudo,
    1 - (c.embedding <=> p_query_embedding) AS similarity,
    c.chunk_index
  FROM public.hub_agente_rag_chunks c
  JOIN public.hub_agente_rag_documentos d ON d.id = c.document_id
  WHERE c.agente_slug = p_agente_slug
    AND d.status = 'pronto'
    AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(p_match_count, 5), 12));
$$;

COMMENT ON TABLE public.hub_agente_rag_documentos IS 'Documentos anexados ao agente para RAG; ficheiro fonte fica no bucket hub-agent-rag-docs.';
COMMENT ON TABLE public.hub_agente_rag_chunks IS 'Chunks textualizados com embedding mistral-embed (1024 dimensÃµes).';
COMMENT ON FUNCTION public.match_hub_agente_rag_chunks IS 'Busca semÃ¢ntica por agente usando cosine distance em pgvector.';

ALTER TABLE public.hub_agente_rag_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_agente_rag_chunks ENABLE ROW LEVEL SECURITY;

-- A aplicaÃ§Ã£o usa SUPABASE_SERVICE_ROLE_KEY nas rotas server-side. PolÃ­ticas de utilizador
-- podem ser adicionadas quando a autenticaÃ§Ã£o/tenant no painel estiver consolidada.


-- ########## supabase/migrations/20260618130000_hub_agente_rag_more_mimes.sql ##########

-- Amplia tipos MIME aceites no bucket RAG (Office, HTML, RTF).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/rtf',
  'text/xml',
  'application/json',
  'application/xml',
  'application/pdf',
  'application/rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/octet-stream'
]::text[]
WHERE id = 'hub-agent-rag-docs';


-- ########## supabase/migrations/20260618140000_hub_agente_uazapi_snapshot_at.sql ##########

-- Momento em que o espelho uazapi_connection_status (e campos relacionados) foi gravado no hub.
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_snapshot_at TIMESTAMPTZ;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_snapshot_at IS
  'Ãšltima gravaÃ§Ã£o local do estado UAZAPI (wizard/ficha); Canais lÃª sÃ³ daqui, sem bater na API externa.';


-- ########## supabase/migrations/20260618150000_hub_delete_agente_cascade_v2.sql ##########

-- ExclusÃ£o completa do agente: RAG, conversas, embeddings, playbook layer, etc.
-- Substitui hub_delete_agente_cascade com limpeza real (DELETE, nÃ£o sÃ³ NULL em logs).

CREATE OR REPLACE FUNCTION public.hub_delete_agente_cascade(p_agente_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_agente_slug IS NULL OR length(trim(p_agente_slug)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'agente_slug invÃ¡lido');
  END IF;

  SET LOCAL app.delete_authorized = true;

  SELECT id INTO v_id
  FROM hub_agente_identidade
  WHERE agente_slug = p_agente_slug
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Agente nÃ£o encontrado');
  END IF;

  -- RAG: chunks e documentos (embeddings pgvector) antes do pai
  IF to_regclass('public.hub_agente_rag_chunks') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_chunks WHERE agente_slug = p_agente_slug;
  END IF;
  IF to_regclass('public.hub_agente_rag_documentos') IS NOT NULL THEN
    DELETE FROM hub_agente_rag_documentos WHERE agente_slug = p_agente_slug;
  END IF;

  -- Ciclos
  DELETE FROM hub_ciclos_log
  WHERE agente_slug = p_agente_slug
     OR ciclo_id IN (SELECT id FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug);

  DELETE FROM hub_ciclos_ia WHERE agente_slug = p_agente_slug;

  -- Conversas / mensagens / fila / prompts (apagar, nÃ£o anonimizar)
  IF to_regclass('public.hub_mensagens') IS NOT NULL AND to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_mensagens
    WHERE conversa_id IN (
      SELECT DISTINCT conversa_id
      FROM hub_prompt_logs
      WHERE agente_slug = p_agente_slug AND conversa_id IS NOT NULL
    );
  END IF;

  IF to_regclass('public.hub_conversas') IS NOT NULL AND to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_conversas
    WHERE id IN (
      SELECT DISTINCT conversa_id
      FROM hub_prompt_logs
      WHERE agente_slug = p_agente_slug AND conversa_id IS NOT NULL
    );
  END IF;

  IF to_regclass('public.hub_conversas_log') IS NOT NULL THEN
    DELETE FROM hub_conversas_log WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_prompt_logs') IS NOT NULL THEN
    DELETE FROM hub_prompt_logs WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_fila_mensagens') IS NOT NULL THEN
    DELETE FROM hub_fila_mensagens WHERE agente_responsavel = p_agente_slug;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'hub_fila_mensagens'
        AND column_name = 'agente_id'
    ) THEN
      EXECUTE 'DELETE FROM hub_fila_mensagens WHERE agente_id = $1' USING p_agente_slug;
    END IF;
  END IF;

  UPDATE hub_leads_crm SET agente_responsavel = NULL WHERE agente_responsavel = p_agente_slug;

  DELETE FROM hub_ml_historico WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_ml_sugestoes
  WHERE agente_slug = p_agente_slug OR supervisor_slug = p_agente_slug;
  DELETE FROM hub_ml_observacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_responsabilidades
  WHERE supervisor_slug = p_agente_slug OR subordinado_slug = p_agente_slug;

  DELETE FROM hub_kpis_resultados WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_kpis_metas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_acoes_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_qualidade_agente WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_aprovacoes WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_alertas WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_regras_ia WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_conhecimento WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_personalidade WHERE agente_slug = p_agente_slug;

  IF to_regclass('public.hub_arquivos') IS NOT NULL THEN
    DELETE FROM hub_arquivos WHERE agente_slug = p_agente_slug;
  END IF;

  IF to_regclass('public.hub_crm_agente_briefing_sessao') IS NOT NULL THEN
    DELETE FROM hub_crm_agente_briefing_sessao WHERE agente_slug = p_agente_slug;
  END IF;

  DELETE FROM hub_autonomia_matriz WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_agente_configuracao WHERE agente_slug = p_agente_slug;
  DELETE FROM hub_scripts WHERE agente_id = v_id;
  DELETE FROM hub_regras_negocio WHERE agente_id = v_id;
  DELETE FROM hub_ml_padroes WHERE agente_id = v_id;

  DELETE FROM hub_agente_identidade WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.hub_delete_agente_cascade(text) IS
  'Apaga agente, RAG (chunks/embeddings), conversas/logs, fila, ciclos e satÃ©lites; Storage via app.';

REVOKE ALL ON FUNCTION public.hub_delete_agente_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_delete_agente_cascade(text) TO service_role;


-- ########## supabase/migrations/20260619100000_hub_agente_uazapi_proxy.sql ##########

-- Proxy regional UAZAPI por agente (cidade do nÃºmero / pareamento QR).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_proxy_country TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_proxy_state TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_proxy_city TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_country IS 'ISO alpha-2 (ex. br) para POST /instance/connect.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_state IS 'UF/submotion (ex. sp) quando exigido pelo catÃ¡logo UAZAPI.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_proxy_city IS 'Slug da cidade (cities[].value) para proxy regional UAZAPI.';


-- ########## supabase/migrations/20260619114000_hub_cargo_atendimento_config.sql ##########

-- ConfiguraÃ§Ã£o operacional por cargo para canais externos (WhatsApp etc.)
-- MantÃ©m comportamento e conhecimento no catÃ¡logo de cargos, reduzindo redundÃ¢ncia no wizard.

ALTER TABLE IF EXISTS public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS saudacao_cliente text,
  ADD COLUMN IF NOT EXISTS usar_perguntas_essenciais boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem_perguntas_essenciais text NOT NULL DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS perguntas_essenciais text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS comprimento_padrao text;

-- Backfill inicial com padrÃµes por tipo de cargo (100% editÃ¡veis no CRM).
UPDATE public.hub_cargos_catalogo
SET
  saudacao_cliente = CASE
    WHEN trim(coalesce(saudacao_cliente, '')) <> '' THEN saudacao_cliente
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|prÃ©-venda|pre-venda)'
      THEN 'OlÃ¡! Aqui Ã© o time de atendimento. Posso te ajudar com algumas perguntas rÃ¡pidas?'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(suporte|support|atendimento|help|sac|pÃ³s-venda|pos-venda)'
      THEN 'OlÃ¡! Aqui Ã© o suporte. Me conta rapidamente o que aconteceu para eu te ajudar.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaÃ§|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'OlÃ¡! Vou validar seu pedido e jÃ¡ te atualizo com o prÃ³ximo passo.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(marketing|trÃ¡fego|trafego|copy|social|conteÃºdo|conteudo)'
      THEN 'OlÃ¡! Vamos entender seu objetivo para te direcionar da melhor forma.'
    ELSE 'OlÃ¡! Aqui Ã© o time de atendimento. Como posso te ajudar hoje?'
  END,
  usar_perguntas_essenciais = CASE
    WHEN usar_perguntas_essenciais = true THEN true
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|prÃ©-venda|pre-venda|suporte|support|atendimento|help|sac|pÃ³s-venda|pos-venda|operaÃ§|operac|analista|finance|cobran|backoffice|processo|marketing|trÃ¡fego|trafego|copy|social|conteÃºdo|conteudo)'
      THEN true
    ELSE false
  END,
  ordem_perguntas_essenciais = CASE
    WHEN coalesce(ordem_perguntas_essenciais, '') IN ('inicio', 'final') THEN ordem_perguntas_essenciais
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaÃ§|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'final'
    ELSE 'inicio'
  END,
  perguntas_essenciais = CASE
    WHEN coalesce(array_length(perguntas_essenciais, 1), 0) > 0 THEN perguntas_essenciais
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|prÃ©-venda|pre-venda)'
      THEN ARRAY[
        'Qual o seu nome?',
        'O que procura no momento?',
        'Qual regiÃ£o ou faixa de valor?',
        'Qual o prazo para decidir?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(suporte|support|atendimento|help|sac|pÃ³s-venda|pos-venda)'
      THEN ARRAY[
        'O que aconteceu exatamente?',
        'Quando comeÃ§ou o problema?',
        'Qual produto/serviÃ§o estÃ¡ envolvido?',
        'Qual Ã© o melhor contato para retorno?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaÃ§|operac|analista|finance|cobran|backoffice|processo)'
      THEN ARRAY[
        'Qual Ã© a sua solicitaÃ§Ã£o principal?',
        'VocÃª tem algum nÃºmero de pedido/protocolo?',
        'HÃ¡ prazo limite para essa solicitaÃ§Ã£o?'
      ]::text[]
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(marketing|trÃ¡fego|trafego|copy|social|conteÃºdo|conteudo)'
      THEN ARRAY[
        'Qual objetivo principal da campanha/projeto?',
        'Qual o pÃºblico-alvo?',
        'Qual orÃ§amento ou limite de investimento?'
      ]::text[]
    ELSE perguntas_essenciais
  END,
  comprimento_padrao = CASE
    WHEN trim(coalesce(comprimento_padrao, '')) <> '' THEN comprimento_padrao
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(operaÃ§|operac|analista|finance|cobran|backoffice|processo)'
      THEN 'MÃ¡x. 3 frases por mensagem; priorize clareza.'
    WHEN concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|closer|vendas|comercial|inside sales|prÃ©-venda|pre-venda|suporte|support|atendimento|help|sac|pÃ³s-venda|pos-venda|marketing|trÃ¡fego|trafego|copy|social|conteÃºdo|conteudo)'
      THEN 'MÃ¡x. 2 frases por mensagem.'
    ELSE 'MÃ¡x. 2 frases por mensagem.'
  END;


-- ########## supabase/migrations/20260619130000_hub_msg_jobs.sql ##########

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.hub_msg_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL,
  canal TEXT NOT NULL,
  telefone TEXT NOT NULL,
  lead_id UUID NULL,
  agente_slug TEXT NULL,
  message_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ NULL,
  locked_by TEXT NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_msg_jobs_status_chk CHECK (status IN ('pending', 'processing', 'done', 'retry', 'dead')),
  CONSTRAINT hub_msg_jobs_canal_message_id_key UNIQUE (canal, message_id)
);

CREATE INDEX IF NOT EXISTS hub_msg_jobs_pending_available_idx
  ON public.hub_msg_jobs (available_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS hub_msg_jobs_telefone_created_at_idx
  ON public.hub_msg_jobs (telefone, created_at DESC);

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_msg_jobs_set_updated_at ON public.hub_msg_jobs;
CREATE TRIGGER trg_hub_msg_jobs_set_updated_at
BEFORE UPDATE ON public.hub_msg_jobs
FOR EACH ROW
EXECUTE FUNCTION public.hub_msg_jobs_set_updated_at();


-- ########## supabase/migrations/20260619133000_hub_msg_jobs_claim_rpc.sql ##########

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_claim_batch(
  p_worker_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS SETOF public.hub_msg_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 1;
  END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT j.id
    FROM public.hub_msg_jobs j
    WHERE
      j.status IN ('pending', 'retry')
      AND j.available_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.hub_msg_jobs p
        WHERE
          p.telefone = j.telefone
          AND p.status = 'processing'
          AND p.id <> j.id
      )
    ORDER BY j.available_at ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  atualizados AS (
    UPDATE public.hub_msg_jobs j
    SET
      status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now(),
      locked_by = NULLIF(trim(p_worker_id), ''),
      last_error = NULL,
      updated_at = now()
    WHERE j.id IN (SELECT c.id FROM candidatos c)
    RETURNING j.*
  )
  SELECT * FROM atualizados;
END;
$$;

COMMENT ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) IS
  'Claim atÃ´mico em lote com SKIP LOCKED para hub_msg_jobs (pending/retry -> processing), preservando exclusÃ£o por telefone.';

REVOKE ALL ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_claim_batch(TEXT, INT) TO service_role;


-- ########## supabase/migrations/20260619134000_hub_msg_jobs_advisory_lock_rpc.sql ##########

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_try_lock_conversation(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT pg_try_advisory_lock(hashtextextended(COALESCE(p_telefone, ''), 0));
$$;

CREATE OR REPLACE FUNCTION public.hub_msg_jobs_unlock_conversation(p_telefone TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT pg_advisory_unlock(hashtextextended(COALESCE(p_telefone, ''), 0));
$$;

COMMENT ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) IS
  'Tenta lock exclusivo por telefone da conversa usando pg_try_advisory_lock.';
COMMENT ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) IS
  'Libera lock exclusivo por telefone da conversa usando pg_advisory_unlock.';

REVOKE ALL ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_try_lock_conversation(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_msg_jobs_unlock_conversation(TEXT) TO service_role;


-- ########## supabase/migrations/20260619140000_hub_memorias_agente.sql ##########

-- MemÃ³rias persistentes por agente (interno + externo): aprendizados operacionais, preferÃªncias de equipa, padrÃµes recorrentes.

CREATE TABLE IF NOT EXISTS public.hub_memorias_agente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL REFERENCES public.hub_tenants (id) ON DELETE SET NULL,
  agente_slug TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  confianca NUMERIC(3, 2) NOT NULL DEFAULT 0.70 CHECK (confianca >= 0 AND confianca <= 1),
  origem TEXT NOT NULL DEFAULT 'ia_engine' CHECK (origem IN ('ia_engine', 'briefing', 'whatsapp', 'manual')),
  criado_por TEXT NOT NULL DEFAULT 'ia',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_memorias_agente_slug_confianca_idx
  ON public.hub_memorias_agente (agente_slug, confianca DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS hub_memorias_agente_tenant_slug_idx
  ON public.hub_memorias_agente (tenant_id, agente_slug);

CREATE OR REPLACE FUNCTION public.hub_memorias_agente_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_memorias_agente_set_updated_at ON public.hub_memorias_agente;
CREATE TRIGGER trg_hub_memorias_agente_set_updated_at
BEFORE UPDATE ON public.hub_memorias_agente
FOR EACH ROW
EXECUTE FUNCTION public.hub_memorias_agente_set_updated_at();

COMMENT ON TABLE public.hub_memorias_agente IS
  'MemÃ³rias persistentes do agente (nÃ£o do lead): contexto operacional reutilizado em WhatsApp, briefing interno e simulaÃ§Ã£o.';


-- ########## supabase/migrations/20260619150000_normalize_agente_modelo_mistral.sql ##########

-- Normaliza modelos legados Anthropic â†’ sentinel Mistral (Hub Mistral-first).
-- Corrige sync Mistral Agents API que rejeita IDs claude-*.

UPDATE public.hub_agente_identidade
SET
  modelo_padrao = 'mistral',
  modelo_critico = 'mistral',
  modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(modelo_padrao)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_padrao) ~* '^claude-'
  OR btrim(modelo_padrao) IN (
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-7'
  )
  OR NOT public.hub_agente_modelo_id_valido(modelo_padrao);

UPDATE public.hub_agente_identidade
SET modelo_critico = 'mistral'
WHERE
  lower(btrim(modelo_critico)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_critico) ~* '^claude-'
  OR NOT public.hub_agente_modelo_id_valido(modelo_critico);

UPDATE public.hub_agente_identidade
SET modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(modelo_alto_valor)) IN ('haiku', 'sonnet', 'opus')
  OR btrim(modelo_alto_valor) ~* '^claude-'
  OR NOT public.hub_agente_modelo_id_valido(modelo_alto_valor);

-- CatÃ¡logo de cargos (novos agentes herdam daqui)
UPDATE public.hub_cargos_catalogo
SET
  modelo_padrao = 'mistral',
  modelo_critico = 'mistral',
  modelo_alto_valor = 'mistral'
WHERE
  lower(btrim(COALESCE(modelo_padrao, ''))) IN ('haiku', 'sonnet', 'opus')
  OR btrim(COALESCE(modelo_padrao, '')) ~* '^claude-';

COMMENT ON COLUMN public.hub_agente_identidade.modelo_padrao IS
  'Sentinel mistral (MISTRAL_MODEL) ou ID Mistral explÃ­cito. Sync Mistral Agents usa sempre famÃ­lia Mistral.';


-- ########## supabase/migrations/20260620160000_hub_fila_mensagens_lead_fk_crm.sql ##########

-- hub_fila_mensagens.lead_id deve apontar para hub_leads_crm (WhatsApp / CRM operacional).
ALTER TABLE public.hub_fila_mensagens
  DROP CONSTRAINT IF EXISTS hub_fila_mensagens_lead_id_fkey;

DO $$
BEGIN
  IF to_regclass('public.hub_leads_crm') IS NOT NULL THEN
    ALTER TABLE public.hub_fila_mensagens
      ADD CONSTRAINT hub_fila_mensagens_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hub_fila_mensagens_lead_fk_crm: %', SQLERRM;
END $$;

COMMENT ON CONSTRAINT hub_fila_mensagens_lead_id_fkey ON public.hub_fila_mensagens IS
  'Lead CRM WhatsApp (hub_leads_crm.id).';


-- ########## supabase/migrations/20260620170000_garantir_agentes_whatsapp_operacao.sql ##########

-- Garante que todos os agentes com linha WhatsApp (UAZAPI) operem como canal_whatsapp
-- com motor de ferramentas e cargo de atendimento com perguntas essenciais fluidas.

UPDATE public.hub_agente_identidade
SET
  modo_operacao = 'canal_whatsapp',
  ciclo_execucao_padrao = COALESCE(ciclo_execucao_padrao, 'interacao'),
  motor_ferramentas_habilitado = true,
  uso_ferramentas_ia = COALESCE(uso_ferramentas_ia, '{}'::jsonb) || jsonb_build_object(
    'hub_atualizar_lead', true,
    'hub_lead_memorias', true,
    'hub_lead_resumo', true,
    'hub_registar_nota_lead', true
  ),
  atualizado_em = now()
WHERE ativo IS NOT DISTINCT FROM true
  AND arquivado_em IS NULL
  AND NULLIF(trim(coalesce(uazapi_instance_token, '')), '') IS NOT NULL;

-- Cargos de atendimento / qualificaÃ§Ã£o: perguntas essenciais (padrÃ£o Obra10+ do wizard)
UPDATE public.hub_cargos_catalogo
SET
  usar_perguntas_essenciais = true,
  ordem_perguntas_essenciais = COALESCE(
    NULLIF(trim(ordem_perguntas_essenciais), ''),
    'inicio'
  ),
  saudacao_cliente = COALESCE(
    NULLIF(trim(saudacao_cliente), ''),
    'Oi, tudo bem? Meu nome Ã© [Nome], da Obra10+. Vi que vocÃª entrou em contato conosco â€” como posso te ajudar hoje? Qual seu Nome?'
  ),
  comprimento_padrao = COALESCE(
    NULLIF(trim(comprimento_padrao), ''),
    'Respostas devem ser objetivas, com no mÃ¡ximo 2 frases por mensagem.'
  ),
  perguntas_essenciais = CASE
    WHEN coalesce(array_length(perguntas_essenciais, 1), 0) >= 1 THEN perguntas_essenciais
    ELSE ARRAY[
      'Qual Ã© o principal objetivo que vocÃª busca com esse projeto ou reforma?',
      'Qual Ã© o seu orÃ§amento estimado para esse projeto?',
      'Qual Ã© o prazo que vocÃª tem em mente para iniciar ou concluir?',
      'Quem sÃ£o os decisores envolvidos nesse processo?',
      'JÃ¡ trabalhou com algum fornecedor ou prestador de serviÃ§o neste tipo de projeto?'
    ]::text[]
  END,
  atualizado_em = now()
WHERE ativo IS NOT DISTINCT FROM true
  AND (
    concat_ws(' ', slug, titulo, segmento, especialidade) ~* '(sdr|qualific|atend|comercial|vendas|closer|capta|obra10|whatsapp)'
    OR coalesce(array_length(perguntas_essenciais, 1), 0) >= 1
    OR usar_perguntas_essenciais = true
  );

COMMENT ON COLUMN public.hub_cargos_catalogo.perguntas_essenciais IS
  'Perguntas obrigatÃ³rias do cargo; a engine injeta sÃ³ a prÃ³xima por turno (nÃ£o lista completa ao cliente).';


-- ########## supabase/migrations/20260620180000_hub_pipelines_vinculos.sql ##########

-- Pipelines configurÃ¡veis (leads/negÃ³cios), estÃ¡gios customizÃ¡veis e vÃ­nculos de negÃ³cio com rastreio por cÃ³digo.

-- â”€â”€â”€ Pipelines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('lead', 'negocio')),
  mercado_sigla   TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  tenant_id       UUID REFERENCES public.hub_tenants(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_pipelines_slug_tenant_unique
  ON public.hub_pipelines (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS idx_hub_pipelines_tipo ON public.hub_pipelines (tipo, ativo);

-- â”€â”€â”€ EstÃ¡gios por pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_pipeline_estagios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES public.hub_pipelines(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  label           TEXT NOT NULL,
  cor             TEXT NOT NULL DEFAULT '#6B7280',
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  tipo_fecho      TEXT NOT NULL DEFAULT 'aberto'
    CHECK (tipo_fecho IN ('aberto', 'ganho', 'perdido')),
  sistema         BOOLEAN NOT NULL DEFAULT false,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_pipeline_estagios_pipeline
  ON public.hub_pipeline_estagios (pipeline_id, ordem);

-- â”€â”€â”€ VÃ­nculos negÃ³cio â†” entidades (PES, LED, EMP, PAR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_negocio_vinculos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES public.hub_negocios(id) ON DELETE CASCADE,
  entidade_tipo   TEXT NOT NULL
    CHECK (entidade_tipo IN ('pessoa', 'empresa', 'parceiro', 'lead')),
  entidade_id     UUID NOT NULL,
  codigo_rastreio TEXT,
  papel           TEXT NOT NULL DEFAULT 'participante'
    CHECK (papel IN (
      'cliente', 'contato_principal', 'lead_origem', 'empresa',
      'parceiro', 'indicador', 'participante'
    )),
  tenant_id       UUID REFERENCES public.hub_tenants(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_negocio_vinculos_negocio
  ON public.hub_negocio_vinculos (negocio_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_negocio_vinculos_unique
  ON public.hub_negocio_vinculos (negocio_id, entidade_tipo, entidade_id, papel);

-- â”€â”€â”€ Colunas pipeline nos registos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pipeline_id UUID
  REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID
  REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;

-- Relaxar CHECK fixo de estÃ¡gio/etapa (validaÃ§Ã£o na app + hub_pipeline_estagios)
ALTER TABLE public.hub_leads_crm DROP CONSTRAINT IF EXISTS hub_leads_crm_estagio_chk;
ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_etapa_chk;

-- FK lead CRM em negÃ³cios (substitui referÃªncia legada hub_leads quando existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_negocios_lead_crm_fkey') THEN
    ALTER TABLE public.hub_negocios
      ADD CONSTRAINT hub_negocios_lead_crm_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Migrar etapas antigas de negÃ³cio para o funil unificado
UPDATE public.hub_negocios SET etapa = 'novo'         WHERE etapa = 'briefing';
UPDATE public.hub_negocios SET etapa = 'qualificado'  WHERE etapa = 'match';
UPDATE public.hub_negocios SET etapa = 'negociando'   WHERE etapa IN ('sit-down', 'sit_down');
UPDATE public.hub_negocios SET etapa = 'ganho'        WHERE etapa = 'concluido';

-- â”€â”€â”€ Seed pipelines globais + 8 estÃ¡gios padrÃ£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'leads-global', 'Leads â€” Pipeline global', 'lead', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM public.hub_pipelines WHERE slug = 'leads-global' AND tenant_id IS NULL);

INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'negocios-global', 'NegÃ³cios â€” Pipeline global', 'negocio', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM public.hub_pipelines WHERE slug = 'negocios-global' AND tenant_id IS NULL);

DO $$
DECLARE
  pid_lead UUID;
  pid_neg UUID;
BEGIN
  SELECT id INTO pid_lead FROM public.hub_pipelines WHERE slug = 'leads-global' AND tenant_id IS NULL LIMIT 1;
  SELECT id INTO pid_neg FROM public.hub_pipelines WHERE slug = 'negocios-global' AND tenant_id IS NULL LIMIT 1;

  IF pid_lead IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_lead, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
      ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
      ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
      ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
      ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
      ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
      ('ganho',        'âœ“ Ganhos',     '#22C55E', 6, 'ganho'),
      ('perdido',      'âœ— Perdidos',   '#EF4444', 7, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;

    UPDATE public.hub_leads_crm SET pipeline_id = pid_lead WHERE pipeline_id IS NULL;
  END IF;

  IF pid_neg IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_neg, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
      ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
      ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
      ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
      ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
      ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
      ('ganho',        'âœ“ Ganhos',     '#22C55E', 6, 'ganho'),
      ('perdido',      'âœ— Perdidos',   '#EF4444', 7, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;

    UPDATE public.hub_negocios SET pipeline_id = pid_neg WHERE pipeline_id IS NULL;
  END IF;
END $$;

-- RLS (mesmo padrÃ£o anon do CRM)
ALTER TABLE public.hub_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_pipeline_estagios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_negocio_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_pipelines_anon ON public.hub_pipelines;
CREATE POLICY hub_pipelines_anon ON public.hub_pipelines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_pipeline_estagios_anon ON public.hub_pipeline_estagios;
CREATE POLICY hub_pipeline_estagios_anon ON public.hub_pipeline_estagios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_negocio_vinculos_anon ON public.hub_negocio_vinculos;
CREATE POLICY hub_negocio_vinculos_anon ON public.hub_negocio_vinculos FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_pipelines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_pipeline_estagios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_negocio_vinculos TO anon, authenticated;

COMMENT ON TABLE public.hub_pipelines IS 'Funis configurÃ¡veis (leads e negÃ³cios) por mercado ou global.';
COMMENT ON TABLE public.hub_pipeline_estagios IS 'Colunas/estÃ¡gios de cada pipeline; ativo=false oculta no kanban.';
COMMENT ON TABLE public.hub_negocio_vinculos IS 'Participantes do negÃ³cio com cÃ³digo de rastreio (PES, LED, EMP, PAR).';


-- ########## supabase/migrations/20260620183000_hub_pipelines_seed_mercados.sql ##########

-- Seed adicional: pipelines por mercado (lead e negÃ³cio) com os 8 estÃ¡gios padrÃ£o.

DO $$
DECLARE
  sigla TEXT;
  nome TEXT;
  pid UUID;
BEGIN
  FOR sigla, nome IN
    SELECT * FROM (
      VALUES
        ('IMB', 'ImobiliÃ¡rio'),
        ('ARQ', 'Arquitetura'),
        ('RFM', 'Reforma e obra'),
        ('MRC', 'Marcenaria e mÃ³veis'),
        ('ENG', 'Engenharia civil'),
        ('SRV', 'ServiÃ§os'),
        ('PRO', 'Produtos e materiais'),
        ('FOR', 'Fornecedor / homologaÃ§Ã£o')
    ) AS mercados(sigla, nome)
  LOOP
    INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
    SELECT LOWER('leads-' || sigla), 'Leads â€” ' || nome, 'lead', sigla, 10
    WHERE NOT EXISTS (
      SELECT 1 FROM public.hub_pipelines
      WHERE slug = LOWER('leads-' || sigla) AND tenant_id IS NULL
    );

    INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
    SELECT LOWER('negocios-' || sigla), 'NegÃ³cios â€” ' || nome, 'negocio', sigla, 20
    WHERE NOT EXISTS (
      SELECT 1 FROM public.hub_pipelines
      WHERE slug = LOWER('negocios-' || sigla) AND tenant_id IS NULL
    );

    SELECT id INTO pid
    FROM public.hub_pipelines
    WHERE slug = LOWER('leads-' || sigla) AND tenant_id IS NULL
    LIMIT 1;

    IF pid IS NOT NULL THEN
      INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
      SELECT pid, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
      FROM (VALUES
        ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
        ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
        ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
        ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
        ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
        ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
        ('ganho',        'âœ“ Ganhos',     '#22C55E', 6, 'ganho'),
        ('perdido',      'âœ— Perdidos',   '#EF4444', 7, 'perdido')
      ) AS v(slug, label, cor, ordem, tipo_fecho)
      ON CONFLICT (pipeline_id, slug) DO NOTHING;
    END IF;

    SELECT id INTO pid
    FROM public.hub_pipelines
    WHERE slug = LOWER('negocios-' || sigla) AND tenant_id IS NULL
    LIMIT 1;

    IF pid IS NOT NULL THEN
      INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
      SELECT pid, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
      FROM (VALUES
        ('novo',         'Novos',        '#6B7280', 0, 'aberto'),
        ('qualificando', 'Qualificando', '#3B82F6', 1, 'aberto'),
        ('qualificado',  'Qualificado',  '#06B6D4', 2, 'aberto'),
        ('proposta',     'Proposta',     '#EAB308', 3, 'aberto'),
        ('negociando',   'Negociando',   '#F97316', 4, 'aberto'),
        ('fechamento',   'Fechamento',   '#A855F7', 5, 'aberto'),
        ('ganho',        'âœ“ Ganhos',     '#22C55E', 6, 'ganho'),
        ('perdido',      'âœ— Perdidos',   '#EF4444', 7, 'perdido')
      ) AS v(slug, label, cor, ordem, tipo_fecho)
      ON CONFLICT (pipeline_id, slug) DO NOTHING;
    END IF;
  END LOOP;
END $$;


-- ########## supabase/migrations/20260628120000_hub_pipeline_estagios_pdf_seed.sql ##########

-- Seed estÃ¡gios PDF (Funil Operacional) em hub_pipeline_estagios â€” aditivo, nÃ£o remove slugs legados.

-- â”€â”€â”€ Leads global: 8 etapas PDF â”€â”€â”€
DO $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.hub_pipelines
  WHERE slug IN ('leads-global', 'lead-global') AND tenant_id IS NULL
  ORDER BY CASE slug WHEN 'leads-global' THEN 0 ELSE 1 END
  LIMIT 1;

  IF pid IS NULL THEN
    INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
    VALUES ('leads-global', 'Leads â€” Funil operacional', 'lead', NULL, 0)
    RETURNING id INTO pid;
  END IF;

  INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema, ativo)
  SELECT pid, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true, true
  FROM (VALUES
    ('novo',                  'Novo',                    '#6B7280', 0,  'aberto'),
    ('em_atendimento',        'Em atendimento',          '#3B82F6', 1,  'aberto'),
    ('aguardando_resposta',   'Aguardando resposta',     '#06B6D4', 2,  'aberto'),
    ('qualificando',          'Qualificando',            '#8B5CF6', 3,  'aberto'),
    ('encaminhado',           'Encaminhado',             '#F59E0B', 4,  'aberto'),
    ('convertido_negocio',    'Convertido em negÃ³cio',   '#22C55E', 5,  'ganho'),
    ('perdido',               'Perdido',                 '#EF4444', 6,  'perdido'),
    ('spam_invalido',         'Spam ou invÃ¡lido',        '#9CA3AF', 7,  'perdido')
  ) AS v(slug, label, cor, ordem, tipo_fecho)
  ON CONFLICT (pipeline_id, slug) DO UPDATE SET
    label = EXCLUDED.label,
    cor = EXCLUDED.cor,
    ordem = EXCLUDED.ordem,
    tipo_fecho = EXCLUDED.tipo_fecho,
    ativo = true,
    sistema = true;

  UPDATE public.hub_pipeline_estagios SET ativo = false
  WHERE pipeline_id = pid
    AND slug IN ('qualificado', 'proposta', 'negociando', 'fechamento', 'ganho')
    AND slug NOT IN (
      'novo', 'em_atendimento', 'aguardando_resposta', 'qualificando',
      'encaminhado', 'convertido_negocio', 'perdido', 'spam_invalido'
    );
END $$;

-- â”€â”€â”€ NegÃ³cios por mercado (etapas PDF) â”€â”€â”€
DO $$
DECLARE
  merc RECORD;
  pid UUID;
  etapa RECORD;
  ord INTEGER;
  tf TEXT;
BEGIN
  FOR merc IN
    SELECT * FROM (VALUES
      ('imb', 'imobiliario'),
      ('arq', 'arquitetura'),
      ('rfm', 'obra_reforma'),
      ('eng', 'engenharia'),
      ('mrc', 'marcenaria_moveis'),
      ('srv', 'servicos'),
      ('pro', 'produtos_materiais'),
      ('for', 'fornecedor_homologacao')
    ) AS m(sigla, mercado_key)
  LOOP
    SELECT id INTO pid FROM public.hub_pipelines
    WHERE slug = 'negocios-' || merc.sigla AND tenant_id IS NULL
    LIMIT 1;

    IF pid IS NULL THEN
      CONTINUE;
    END IF;

    ord := 0;
    FOR etapa IN
      SELECT * FROM (VALUES
        ('imb', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('imb', 'contato_validado', 'Contato validado', 'aberto'),
        ('imb', 'encaminhado_corretor', 'Encaminhado ao corretor', 'aberto'),
        ('imb', 'atendimento_corretor', 'Em atendimento pelo corretor', 'aberto'),
        ('imb', 'imovel_selecionado_captado', 'ImÃ³vel selecionado ou captado', 'aberto'),
        ('imb', 'visita_agendada', 'Visita ou avaliaÃ§Ã£o agendada', 'aberto'),
        ('imb', 'proposta_negociacao', 'Proposta em negociaÃ§Ã£o', 'aberto'),
        ('imb', 'documentacao', 'DocumentaÃ§Ã£o em andamento', 'aberto'),
        ('imb', 'fechado_ganho', 'Fechado ganho', 'ganho'),
        ('imb', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('arq', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('arq', 'contato_validado', 'Contato validado', 'aberto'),
        ('arq', 'briefing_inicial', 'Briefing inicial', 'aberto'),
        ('arq', 'reuniao_agendada', 'ReuniÃ£o agendada', 'aberto'),
        ('arq', 'briefing_completo', 'Briefing completo', 'aberto'),
        ('arq', 'proposta_elaboracao', 'Proposta em elaboraÃ§Ã£o', 'aberto'),
        ('arq', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('arq', 'negociacao', 'NegociaÃ§Ã£o', 'aberto'),
        ('arq', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('arq', 'fechado_ganho', 'Fechado ganho', 'ganho'),
        ('arq', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('rfm', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('rfm', 'contato_validado', 'Contato validado', 'aberto'),
        ('rfm', 'escopo_inicial', 'Escopo inicial recebido', 'aberto'),
        ('rfm', 'visita_agendada', 'Visita tÃ©cnica agendada', 'aberto'),
        ('rfm', 'levantamento', 'Levantamento realizado', 'aberto'),
        ('rfm', 'orcamento_elaboracao', 'OrÃ§amento em elaboraÃ§Ã£o', 'aberto'),
        ('rfm', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('rfm', 'negociacao', 'NegociaÃ§Ã£o', 'aberto'),
        ('rfm', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('rfm', 'obra_criada', 'Obra criada', 'ganho'),
        ('rfm', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('eng', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('eng', 'contato_validado', 'Contato validado', 'aberto'),
        ('eng', 'demanda_entendida', 'Demanda tÃ©cnica entendida', 'aberto'),
        ('eng', 'documentos_solicitados', 'Documentos solicitados', 'aberto'),
        ('eng', 'analise_tecnica', 'AnÃ¡lise tÃ©cnica', 'aberto'),
        ('eng', 'visita_tecnica', 'Visita tÃ©cnica, se necessÃ¡rio', 'aberto'),
        ('eng', 'proposta_tecnica', 'Proposta tÃ©cnica', 'aberto'),
        ('eng', 'proposta_comercial', 'Proposta comercial', 'aberto'),
        ('eng', 'negociacao', 'NegociaÃ§Ã£o', 'aberto'),
        ('eng', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('eng', 'projeto_obra_criado', 'Projeto ou obra criado', 'ganho'),
        ('eng', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('mrc', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('mrc', 'contato_validado', 'Contato validado', 'aberto'),
        ('mrc', 'ambiente_identificado', 'Ambiente identificado', 'aberto'),
        ('mrc', 'medidas_solicitadas', 'Medidas ou projeto solicitado', 'aberto'),
        ('mrc', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('mrc', 'cotacao', 'CotaÃ§Ã£o em andamento', 'aberto'),
        ('mrc', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('mrc', 'negociacao', 'NegociaÃ§Ã£o', 'aberto'),
        ('mrc', 'pedido_aprovado', 'Pedido aprovado', 'aberto'),
        ('mrc', 'producao_entrega', 'ProduÃ§Ã£o ou entrega criada', 'ganho'),
        ('mrc', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('srv', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('srv', 'contato_validado', 'Contato validado', 'aberto'),
        ('srv', 'servico_identificado', 'ServiÃ§o identificado', 'aberto'),
        ('srv', 'fotos_solicitadas', 'Fotos ou informaÃ§Ãµes solicitadas', 'aberto'),
        ('srv', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('srv', 'cotacao', 'CotaÃ§Ã£o em andamento', 'aberto'),
        ('srv', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('srv', 'execucao_agendada', 'ExecuÃ§Ã£o agendada', 'aberto'),
        ('srv', 'servico_fechado', 'ServiÃ§o fechado', 'ganho'),
        ('srv', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('pro', 'novo_negocio', 'Novo negÃ³cio', 'aberto'),
        ('pro', 'contato_validado', 'Contato validado', 'aberto'),
        ('pro', 'produto_identificado', 'Produto identificado', 'aberto'),
        ('pro', 'especificacao_recebida', 'Quantidade ou especificaÃ§Ã£o recebida', 'aberto'),
        ('pro', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('pro', 'cotacao', 'CotaÃ§Ã£o em andamento', 'aberto'),
        ('pro', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('pro', 'pedido_aprovado', 'Pedido aprovado', 'aberto'),
        ('pro', 'entrega_andamento', 'Entrega em andamento', 'ganho'),
        ('pro', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('for', 'cadastro_recebido', 'Cadastro recebido', 'aberto'),
        ('for', 'dados_validados', 'Dados mÃ­nimos validados', 'aberto'),
        ('for', 'documentos_solicitados', 'Documentos solicitados', 'aberto'),
        ('for', 'documentacao_pendente', 'DocumentaÃ§Ã£o pendente', 'aberto'),
        ('for', 'em_analise', 'Em anÃ¡lise', 'aberto'),
        ('for', 'entrevista', 'Entrevista ou reuniÃ£o', 'aberto'),
        ('for', 'avaliacao_tecnica', 'AvaliaÃ§Ã£o tÃ©cnica', 'aberto'),
        ('for', 'avaliacao_comercial', 'AvaliaÃ§Ã£o comercial', 'aberto'),
        ('for', 'aprovado', 'Aprovado', 'aberto'),
        ('for', 'homologado', 'Homologado', 'ganho'),
        ('for', 'reprovado', 'Reprovado', 'perdido'),
        ('for', 'suspenso', 'Suspenso', 'perdido')
      ) AS e(sigla, slug, label, tipo_fecho)
      WHERE e.sigla = merc.sigla
    LOOP
      INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema, ativo)
      VALUES (pid, etapa.slug, etapa.label, '#6B7280', ord, etapa.tipo_fecho, true, true)
      ON CONFLICT (pipeline_id, slug) DO UPDATE SET
        label = EXCLUDED.label,
        ordem = EXCLUDED.ordem,
        tipo_fecho = EXCLUDED.tipo_fecho,
        ativo = true;
      ord := ord + 1;
    END LOOP;

    UPDATE public.hub_pipeline_estagios SET ativo = false
    WHERE pipeline_id = pid
      AND slug IN ('novo', 'qualificando', 'qualificado', 'proposta', 'negociando', 'fechamento', 'ganho', 'perdido')
      AND slug NOT IN (
        SELECT slug FROM public.hub_pipeline_estagios
        WHERE pipeline_id = pid AND sistema = true AND ativo = true
      );
  END LOOP;
END $$;

-- â”€â”€â”€ Migrar valores em hub_leads_crm para slugs PDF â”€â”€â”€
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS estagio_funil TEXT;

-- CHECK legado (novo, qualificado, ganhoâ€¦) bloqueia slugs PDF; validaÃ§Ã£o na app + hub_pipeline_estagios
ALTER TABLE public.hub_leads_crm DROP CONSTRAINT IF EXISTS hub_leads_crm_estagio_check;
ALTER TABLE public.hub_leads_crm DROP CONSTRAINT IF EXISTS hub_leads_crm_estagio_chk;

UPDATE public.hub_leads_crm SET estagio = CASE estagio
  WHEN 'qualificado' THEN 'qualificando'
  WHEN 'proposta' THEN 'encaminhado'
  WHEN 'negociando' THEN 'em_atendimento'
  WHEN 'fechamento' THEN 'encaminhado'
  WHEN 'ganho' THEN 'convertido_negocio'
  ELSE estagio
END
WHERE estagio IN ('qualificado', 'proposta', 'negociando', 'fechamento', 'ganho');

UPDATE public.hub_leads_crm SET estagio_funil = estagio WHERE estagio_funil IS NULL;


-- ########## zor-01-gaps ##########

-- =============================================================================
-- ZOR â€” tabelas usadas pelo cÃ³digo mas sem CREATE nas migraÃ§Ãµes do repo
-- Executar DEPOIS de zor-schema-completo.sql (ou quando CREATE falhar por tabela inexistente)
-- =============================================================================

-- â”€â”€â”€ Hierarquia / fluxos / regras IA (router + engine) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_hierarquia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  nivel_org INTEGER NOT NULL CHECK (nivel_org >= 1 AND nivel_org <= 5),
  area TEXT NOT NULL,
  superior_id UUID REFERENCES public.hub_hierarquia(id),
  avatar_url TEXT,
  cor TEXT DEFAULT '#f97316',
  responsabilidades TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  fluxos JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  nivel TEXT,
  agente_slug TEXT,
  supervisor_slug TEXT,
  subordinados JSONB DEFAULT '[]',
  criterios_escalonamento TEXT,
  limite_autonomia_brl NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hub_fluxos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area TEXT NOT NULL,
  descricao TEXT,
  etapas JSONB NOT NULL DEFAULT '[]',
  responsaveis JSONB NOT NULL DEFAULT '[]',
  gatilhos JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  agente_slug TEXT,
  fase TEXT,
  proximo_passo TEXT,
  acao_esperada TEXT,
  ativo BOOLEAN DEFAULT true,
  desativado_em TIMESTAMPTZ,
  desativado_motivo TEXT
);

CREATE TABLE IF NOT EXISTS public.hub_regras_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  condicao JSONB NOT NULL DEFAULT '{}',
  acao JSONB NOT NULL DEFAULT '{}',
  modelo_ia TEXT DEFAULT 'mistral-small-latest',
  ativo BOOLEAN DEFAULT true,
  aprendizado JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  agente_slug TEXT,
  instrucao TEXT,
  prioridade INTEGER DEFAULT 0
);

-- â”€â”€â”€ Ciclos IA (automaÃ§Ãµes /crm/ciclos) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_ciclos_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('continuo', 'programado', 'gatilho')),
  cron_expressao TEXT,
  intervalo_minutos INTEGER,
  ativo BOOLEAN DEFAULT true,
  ultimo_ciclo TIMESTAMPTZ,
  proximo_ciclo TIMESTAMPTZ,
  ultimo_status TEXT DEFAULT 'nunca_executado',
  ultimo_resultado JSONB DEFAULT '{}',
  total_execucoes INTEGER DEFAULT 0,
  total_alertas_gerados INTEGER DEFAULT 0,
  configuracoes JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_ciclos_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID REFERENCES public.hub_ciclos_ia(id) ON DELETE SET NULL,
  agente_slug TEXT NOT NULL,
  iniciado_em TIMESTAMPTZ DEFAULT NOW(),
  finalizado_em TIMESTAMPTZ,
  status TEXT DEFAULT 'rodando' CHECK (status IN ('rodando', 'sucesso', 'erro', 'sem_acao')),
  acoes_tomadas JSONB DEFAULT '[]',
  alertas_gerados JSONB DEFAULT '[]',
  erro TEXT,
  tokens_usados INTEGER DEFAULT 0,
  custo_brl NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hub_ciclos_ia_agente ON public.hub_ciclos_ia (agente_slug, ativo);
CREATE INDEX IF NOT EXISTS idx_hub_ciclos_log_ciclo ON public.hub_ciclos_log (ciclo_id, iniciado_em DESC);

-- â”€â”€â”€ CatÃ¡logos (CRM agentes â€” se migrations nÃ£o criaram) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.hub_cargos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  area TEXT,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_mercados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  prefixo TEXT,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_perfis_personalidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);


-- ########## zor-02-seed ##########

-- =============================================================================
-- ZOR â€” tenant inicial + funÃ§Ã£o default (prod)
-- UUID fixo para colocar em DEFAULT_TENANT_ID e NEXT_PUBLIC_TENANT_ID no Render/.env
-- =============================================================================

INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid,
  'zor',
  'Zor',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  nome_exibicao = EXCLUDED.nome_exibicao,
  ativo = EXCLUDED.ativo;

-- Opcional: manter tambÃ©m tenant legado usado por migraÃ§Ãµes antigas (RLS anon)
INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+ (legado RLS)',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Apontar default_obra10_tenant_id para Zor (opcional â€” descomente se quiser RLS anon no tenant Zor)
-- CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
-- RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
--   SELECT 'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid;
-- $$;

COMMENT ON TABLE public.hub_tenants IS 'Multi-tenant: use slug=zor, id=a1b2c3d4-e5f6-4789-a012-3456789abcde no .env';

