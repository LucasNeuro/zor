-- CAMPANHAS
INSERT INTO campanhas (codigo, nome, canal, budget_diario, gasto_hoje, leads_gerados, cpl_atual, roas_atual) VALUES
('META001', 'Reforma SP — Meta Ads',        'meta_ads',   2400, 2040, 34, 89, 3.8),
('GOOG001', 'Reforma SP — Google Search',   'google_ads', 1800, 1260, 28, 64, 4.2),
('ORG001',  'Orgânico — Instagram',         'organico',      0,    0,  8,  0, 0.0),
('IND001',  'Indicação — Parceiros',        'indicacao',     0,    0,  4,  0, 0.0)
ON CONFLICT (codigo) DO NOTHING;

-- PESSOAS
INSERT INTO pessoas (codigo, nome, telefone, whatsapp_id, tipo) VALUES
('PES-2026-001', 'Carlos Mendes',           '11998765432', '5511998765432', 'lead'),
('PES-2026-002', 'Ana Paula Ferreira',      '11987654321', '5511987654321', 'lead'),
('PES-2026-003', 'Roberto Lima',            '11976543210', '5511976543210', 'lead'),
('PES-2026-004', 'Construtora Belo Ltda',   '11965432109', '5511965432109', 'fornecedor'),
('PES-2026-005', 'Beatriz Santos',          '11954321098', '5511954321098', 'lead'),
('PES-2026-006', 'João Silva Arquitetura',  '11943210987', null,            'parceiro'),
('PES-2026-007', 'Pedro Santos Engenharia', '11932109876', null,            'parceiro'),
('PES-2026-008', 'Marcenaria Belo',         '11921098765', null,            'parceiro'),
('PES-2026-009', 'Fernando Silva Arq.',     '11910987654', null,            'parceiro')
ON CONFLICT (codigo) DO NOTHING;

-- LEADS
INSERT INTO leads (codigo, pessoa_id, campanha_id, canal, tipo, status, fase_canvas, sala_atual,
  valor_estimado, score_prioridade, sla_target_min, tempo_aguardando_min,
  agente_responsavel_id, ia_status, ultima_mensagem, ultima_mensagem_de)
SELECT 'LEAD-2026-247', p.id, c.id,
  'google_ads', 'reforma', 'qualificando', 'critico', 'active_attendance_stations',
  80000, 96, 5, 18, 'ag-018', 'ativa',
  'Quero reformar minha cozinha e sala', 'lead'
FROM pessoas p, campanhas c
WHERE p.codigo = 'PES-2026-001' AND c.codigo = 'GOOG001'
ON CONFLICT DO NOTHING;

INSERT INTO leads (codigo, pessoa_id, campanha_id, canal, tipo, status, fase_canvas, sala_atual,
  valor_estimado, score_prioridade, sla_target_min, tempo_aguardando_min,
  agente_responsavel_id, ia_status, ultima_mensagem, ultima_mensagem_de)
SELECT 'LEAD-2026-248', p.id, c.id,
  'meta_ads', 'produto_servico', 'qualificando', 'qualificando', 'lead_qualification_zone',
  35000, 71, 10, 7, 'ag-018', 'ativa',
  'Qual o prazo de entrega do piso?', 'lead'
FROM pessoas p, campanhas c
WHERE p.codigo = 'PES-2026-002' AND c.codigo = 'META001'
ON CONFLICT DO NOTHING;

INSERT INTO leads (codigo, pessoa_id, canal, tipo, status, fase_canvas, sala_atual,
  valor_estimado, score_prioridade, sla_target_min, tempo_aguardando_min, ia_status)
SELECT 'LEAD-2026-249', p.id,
  'indicacao', 'mercado_imobiliario', 'aguardando', 'aguardando', 'waiting_area',
  120000, 88, 5, 3, 'ativa'
FROM pessoas p
WHERE p.codigo = 'PES-2026-003'
ON CONFLICT DO NOTHING;

INSERT INTO leads (codigo, pessoa_id, canal, tipo, status, fase_canvas, sala_atual,
  valor_estimado, score_prioridade, sla_target_min, tempo_aguardando_min,
  agente_responsavel_id, ia_status, ultima_mensagem, ultima_mensagem_de)
SELECT 'LEAD-2026-250', p.id,
  'organico', 'fornecedor_homologacao', 'triagem', 'triagem', 'main_reception_desk',
  0, 0, 10, 2, 'ag-019', 'ativa',
  'Quero me cadastrar como parceiro', 'lead'
FROM pessoas p
WHERE p.codigo = 'PES-2026-004'
ON CONFLICT DO NOTHING;

INSERT INTO leads (codigo, pessoa_id, campanha_id, canal, tipo, status, fase_canvas, sala_atual,
  valor_estimado, score_prioridade, sla_target_min, tempo_aguardando_min,
  agente_responsavel_id, ia_status, ultima_mensagem, ultima_mensagem_de)
SELECT 'LEAD-2026-251', p.id, c.id,
  'meta_ads', 'reforma', 'qualificado', 'qualificado', 'active_attendance_stations',
  55000, 82, 5, 1, 'ag-018', 'ativa',
  'Ótimo! Quando podemos agendar?', 'lead'
FROM pessoas p, campanhas c
WHERE p.codigo = 'PES-2026-005' AND c.codigo = 'META001'
ON CONFLICT DO NOTHING;

-- PARCEIROS
INSERT INTO parceiros (codigo, pessoa_id, categoria, especialidade, regiao,
  status, capacidade_semanal, taxa_aceite, taxa_fechamento,
  nps, transparency_score, fit_score, homologacao_etapa, homologacao_pct, comissao_gerada)
SELECT 'PAR-2026-001', p.id,
  'arquitetura', 'Reforma residencial completa', 'São Paulo — Zona Sul e Centro',
  'ativo', 3, 94, 67, 9.1, 92, 94, 'ativo', 100, 28500
FROM pessoas p WHERE p.codigo = 'PES-2026-006'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO parceiros (codigo, pessoa_id, categoria, especialidade, regiao,
  status, capacidade_semanal, taxa_aceite, taxa_fechamento,
  nps, transparency_score, fit_score, homologacao_etapa, homologacao_pct, comissao_gerada)
SELECT 'PAR-2026-002', p.id,
  'engenharia', 'Construção e grandes reformas', 'São Paulo — Zona Norte',
  'ocupado', 2, 85, 72, 7.8, 61, 88, 'ativo', 100, 19200
FROM pessoas p WHERE p.codigo = 'PES-2026-007'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO parceiros (codigo, pessoa_id, categoria, especialidade, regiao,
  status, capacidade_semanal, taxa_aceite, taxa_fechamento,
  nps, transparency_score, fit_score, homologacao_etapa, homologacao_pct, comissao_gerada)
SELECT 'PAR-2026-003', p.id,
  'marcenaria', 'Cozinhas e ambientes planejados', 'São Paulo — Grande SP',
  'ativo', 5, 96, 78, 8.6, 95, 91, 'ativo', 100, 14600
FROM pessoas p WHERE p.codigo = 'PES-2026-008'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO parceiros (codigo, pessoa_id, categoria, especialidade, regiao,
  status, capacidade_semanal, homologacao_etapa, homologacao_pct, fit_score)
SELECT 'PAR-2026-004', p.id,
  'arquitetura', 'Interiores e decoração', 'São Paulo — Zona Oeste',
  'em_homologacao', 4, 'aprovacao', 87, 87
FROM pessoas p WHERE p.codigo = 'PES-2026-009'
ON CONFLICT (codigo) DO NOTHING;

-- AGENTES
INSERT INTO agentes (codigo, nome, cargo, area, sala_id, nivel_hierarquico, humor, personalidade, status, current_activity) VALUES
('ag-001', 'Marina Costa',      'Diretora de Marketing',     'Marketing',   'marketing_director',          2, 'Empático',    'Estratégico',  'online', 'Revisando performance das campanhas'),
('ag-002', 'Lucas Ferreira',    'CEO',                       'Executivo',   'ceo_office',                  1, 'Competitivo', 'Assertivo',    'online', 'Analisando metas do trimestre'),
('ag-003', 'Plano IA',          'Gerente de Estratégia',     'Marketing',   'strategy_planning',           3, 'Analítico',   'Estratégico',  'online', 'Planejando nova campanha'),
('ag-004', 'Brief IA',          'Diretor de Operações',      'Operações',   'meeting_room_01',             2, 'Analítico',   'Formal',       'online', 'Organizando briefings da semana'),
('ag-005', 'Agenda IA',         'Coordenador',               'Operações',   'strategy_planning',           4, 'Pragmático',  'Assertivo',    'online', 'Organizando calendário editorial'),
('ag-006', 'Copy Alpha',        'Copywriter Sênior',         'Marketing',   'copy_lab',                    4, 'Criativo',    'Assertivo',    'online', 'Criando headline para Meta Ads'),
('ag-007', 'Copy Beta',         'Conteúdo Orgânico',         'Marketing',   'copy_lab',                    4, 'Criativo',    'Estratégico',  'online', 'Escrevendo legenda para Reel'),
('ag-008', 'Copy Gamma',        'Variações',                 'Marketing',   'copy_lab',                    4, 'Criativo',    'Casual',       'online', 'Criando variação B do anúncio'),
('ag-009', 'Design Alpha',      'Designer Sênior',           'Marketing',   'design_studio',               4, 'Criativo',    'Assertivo',    'online', 'Criando arte para Meta Ads'),
('ag-010', 'Design Beta',       'UI/UX',                     'Marketing',   'design_studio',               4, 'Empático',    'Estratégico',  'online', 'Otimizando landing page'),
('ag-011', 'Motion IA',         'Motion Designer',           'Marketing',   'content_media',               4, 'Criativo',    'Entusiasta',   'online', 'Editando Reel de reforma'),
('ag-012', 'Tráfego Alpha',     'Google Ads',                'Marketing',   'performance_traffic',         4, 'Analítico',   'Assertivo',    'online', 'Otimizando campanha Search'),
('ag-013', 'Tráfego Beta',      'Meta Ads',                  'Marketing',   'performance_traffic',         4, 'Competitivo', 'Assertivo',    'online', 'Ajustando lances Meta Ads'),
('ag-014', 'Analytics IA',      'Gerente de Dados',          'Marketing',   'performance_traffic',         3, 'Analítico',   'Estratégico',  'online', 'Consolidando dados da semana'),
('ag-015', 'Social Alpha',      'Social Media Manager',      'Marketing',   'social_media_room',           4, 'Criativo',    'Entusiasta',   'online', 'Planejando calendário de conteúdo'),
('ag-016', 'Social Beta',       'Criador de Conteúdo',       'Marketing',   'social_media_room',           4, 'Criativo',    'Casual',       'online', 'Editando Reel de processo de reforma'),
('ag-017', 'Social Gamma',      'Community Manager',         'Marketing',   'social_media_room',           4, 'Empático',    'Entusiasta',   'online', 'Respondendo comentários'),
('ag-018', 'Atendente Alpha',   'SDR',                       'Atendimento', 'active_attendance_stations',  5, 'Empático',    'Entusiasta',   'online', 'Qualificando lead na fila'),
('ag-019', 'Atendente Beta',    'Recepção',                  'Atendimento', 'main_reception_desk',         5, 'Empático',    'Casual',       'online', 'Triando contatos recebidos'),
('ag-020', 'Dir. Comercial',    'Diretor Comercial',         'Comercial',   'commercial_director',         2, 'Competitivo', 'Assertivo',    'online', 'Analisando pipeline comercial'),
('ag-021', 'Ger. Vendas',       'Gerente de Vendas',         'Comercial',   'sales_manager',               3, 'Competitivo', 'Estratégico',  'online', 'Revisando pipeline com Closer'),
('ag-022', 'Closer',            'Closer de Vendas',          'Comercial',   'closer_room',                 4, 'Competitivo', 'Assertivo',    'online', 'Fazendo diagnóstico de projeto'),
('ag-023', 'CS',                'Customer Success',          'Comercial',   'customer_success',            4, 'Empático',    'Estratégico',  'online', 'Verificando satisfação de clientes'),
('ag-024', 'CRM IA',            'Especialista CRM',          'Comercial',   'crm_hub',                     4, 'Analítico',   'Formal',       'online', 'Atualizando pipeline com novos leads'),
('ag-025', 'Ger. Atend.',       'Gerente de Atendimento',    'Atendimento', 'lead_qualification_zone',     3, 'Empático',    'Assertivo',    'online', 'Monitorando qualidade do atendimento')
ON CONFLICT (codigo) DO NOTHING;

-- DECISÕES INICIAIS
INSERT INTO decisoes (status, titulo, resumo, area, impacto_financeiro, prioridade, recomendacao, confianca) VALUES
('critical', 'Lead #247 sem resposta',
  'Lead de R$80k estimados há 18min sem contato. SLA era 5 minutos.',
  'atendimento', 80000, 96,
  'Transferir para SDR Beta e enviar WhatsApp automático agora', 'alta'),
('critical', 'CPL Meta Ads acima da meta',
  'CPL em R$89, meta é R$60. Tendência de alta por 2 dias consecutivos.',
  'marketing', 12000, 72,
  'Trocar criativo antes de pausar. ROAS saudável indica lead de qualidade.', 'alta'),
('warning', 'Parceiro aguardando homologação',
  'Arq. Silva tem score 87/100 e documentação completa. Aguarda aprovação há 3 dias.',
  'homologacao', 25000, 61,
  'Aprovar com limite inicial de 2 leads simultâneos.', 'alta')
ON CONFLICT DO NOTHING;
