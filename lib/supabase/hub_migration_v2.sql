-- hub_migration.sql
-- Sistema de IA e CRM Obra10+
-- Execute via: Supabase Dashboard → SQL Editor

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
-- TABELA 1 — IDENTIDADE DO AGENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS hub_agente_identidade (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_slug       TEXT UNIQUE NOT NULL,
  nome              TEXT NOT NULL,
  descricao         TEXT,
  persona           TEXT,
  tom_voz           TEXT DEFAULT 'profissional e amigável',
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
-- TABELA 2 — CONFIGURAÇÃO DO AGENTE
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
  mensagem_fora_horario       TEXT DEFAULT 'Estamos fora do horário. Retornaremos em breve.',
  ativo                       BOOLEAN DEFAULT true,
  criado_em                   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA 3 — SCRIPTS DE ATENDIMENTO
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
-- TABELA 4 — REGRAS DE NEGÓCIO
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
-- TABELA 5 — MEMÓRIAS DO LEAD
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
-- TABELA 6 — LOGS DE PROMPTS
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
-- TABELA 7 — FILA DE MENSAGENS
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
-- TABELA 8 — CONFIGURAÇÃO WHATSAPP
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
-- TABELA 9 — PADRÕES DE ML
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
-- ÍNDICES
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
-- SEED — Agente Ariane
-- ============================================================

INSERT INTO hub_agente_identidade
  (agente_slug, nome, descricao, tom_voz, system_prompt_base, nunca_dizer, sempre_dizer, modelo_padrao)
VALUES (
  'atendente',
  'Ariane',
  'Agente de atendimento e qualificação inicial de leads',
  'caloroso, profissional e empático',
  'Você é Ariane, assistente virtual da Obra10+, especializada em atendimento de clientes para projetos de construção e reformas. Seu objetivo é qualificar leads, entender suas necessidades e conectá-los com a equipe certa. Seja cordial, objetiva e nunca deixe o cliente sem resposta.',
  '["não sei","não posso","impossível","não faço ideia"]',
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
  'Olá! Estamos fora do horário de atendimento (seg–sex, 8h–18h). Sua mensagem foi recebida e retornaremos assim que possível. Obrigado por entrar em contato com a Obra10+!'
)
ON CONFLICT (agente_slug) DO NOTHING;
