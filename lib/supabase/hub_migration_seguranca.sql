-- ============================================================
-- HUB MIGRATION SEGURANÇA — RLS por camada IA vs Humano
-- ============================================================

-- Função para detectar service_role (humano via painel)
CREATE OR REPLACE FUNCTION hub_is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('role', true) = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CAMADA 1 — IMUTÁVEL (somente leitura para todos)
-- ============================================================

COMMENT ON TABLE hub_kpis_definicao IS 'CAMADA 1 IMUTÁVEL: Alterada apenas por migrations de código. IA e humano têm somente leitura.';
COMMENT ON TABLE hub_responsabilidades IS 'CAMADA 1 IMUTÁVEL: Alterada apenas por migrations de código. IA e humano têm somente leitura.';

-- ============================================================
-- CAMADA 2 — CONFIGURÁVEL (somente humano via service_role)
-- ============================================================

COMMENT ON TABLE hub_agente_identidade IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_agente_configuracao IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_hierarquia IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_personalidade IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_kpis_metas IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_briefings IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';
COMMENT ON TABLE hub_ml_historico IS 'CAMADA 2 CONFIGURÁVEL: Somente humano via painel (service_role). IA tem somente leitura.';

-- Remover políticas antigas abertas das tabelas configuráveis
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
-- CAMADA 3 — OPERACIONAL (IA insere/lê; humano lê+escreve)
-- ============================================================

COMMENT ON TABLE hub_ml_observacoes IS 'CAMADA 3 OPERACIONAL: IA insere observações. Humano lê via painel.';
COMMENT ON TABLE hub_ml_sugestoes IS 'CAMADA 3 OPERACIONAL: IA insere sugestões. Humano aprova/rejeita.';
COMMENT ON TABLE hub_acoes_ia IS 'CAMADA 3 OPERACIONAL: Registro imutável de ações da IA.';
COMMENT ON TABLE hub_kpis_resultados IS 'CAMADA 3 OPERACIONAL: IA registra medições. Humano lê via painel.';
COMMENT ON TABLE hub_aprovacoes IS 'CAMADA 3 OPERACIONAL: IA cria aprovações. Humano decide.';

-- ============================================================
-- TABELA DE AUDITORIA DE SEGURANÇA
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
-- Somente humano (service_role) lê a auditoria
CREATE POLICY "hub_auditoria_humano_ler" ON hub_auditoria_seguranca FOR SELECT USING (hub_is_service_role());
