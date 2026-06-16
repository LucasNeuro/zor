-- Views de relatório personalizado (Dashboard & Relatórios → aba Personalizado).
-- security_invoker = true para respeitar RLS do tenant nas tabelas base.

-- ─── Leads enriquecidos ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_leads_enriquecidos;
CREATE VIEW public.vw_rel_leads_enriquecidos
WITH (security_invoker = true)
AS
SELECT
  l.tenant_id,
  l.id,
  l.codigo,
  l.nome,
  l.telefone,
  l.email,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''), p.email) AS email_exibicao,
  l.origem,
  l.campanha,
  l.estagio,
  l.estagio_funil,
  l.estagio_atendimento,
  l.score,
  l.valor_estimado,
  l.agente_responsavel,
  l.humano_responsavel,
  l.proxima_acao,
  l.data_proxima_acao,
  l.ultimo_contato,
  l.ultima_mensagem,
  l.criado_em,
  l.atualizado_em,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  pl.nome AS pipeline_nome,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN public.hub_pipelines pl ON pl.id = l.pipeline_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

-- ─── Negócios + pipeline comercial ──────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_negocios_pipeline;
CREATE VIEW public.vw_rel_negocios_pipeline
WITH (security_invoker = true)
AS
SELECT
  n.tenant_id,
  n.id,
  n.codigo,
  n.titulo,
  n.descricao,
  n.tipo,
  n.etapa,
  n.status,
  n.valor_estimado,
  n.valor_fechado,
  n.motivo_perda,
  n.proxima_acao,
  n.criado_em,
  n.atualizado_em,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  l.estagio AS lead_estagio,
  p.nome AS pessoa_nome,
  e.nome AS empresa_nome,
  e.cnpj AS empresa_cnpj,
  pl.nome AS pipeline_nome
FROM public.hub_negocios n
LEFT JOIN public.hub_leads_crm l ON l.id = n.lead_id
LEFT JOIN public.hub_pessoas p ON p.id = n.pessoa_id
LEFT JOIN public.hub_empresas e ON e.id = n.empresa_id
LEFT JOIN public.hub_pipelines pl ON pl.id = n.pipeline_id;

-- ─── Cadastros ──────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_pessoas_cadastro;
CREATE VIEW public.vw_rel_pessoas_cadastro
WITH (security_invoker = true)
AS
SELECT
  p.tenant_id,
  p.id,
  p.codigo,
  p.nome,
  p.telefone,
  p.email,
  p.tipo,
  p.tipo_pessoa,
  p.documento,
  p.cidade,
  p.estado,
  p.origem,
  p.area_atuacao,
  p.criado_em,
  e.nome AS empresa_nome,
  e.cnpj AS empresa_cnpj
FROM public.hub_pessoas p
LEFT JOIN public.hub_empresas e ON e.id = p.empresa_id;

DROP VIEW IF EXISTS public.vw_rel_empresas_cadastro;
CREATE VIEW public.vw_rel_empresas_cadastro
WITH (security_invoker = true)
AS
SELECT
  e.tenant_id,
  e.id,
  e.codigo,
  e.nome,
  e.cnpj,
  e.email,
  e.telefone,
  e.cidade,
  e.estado,
  e.ativo,
  e.criado_em,
  e.atualizado_em
FROM public.hub_empresas e;

-- ─── Atividades e notas ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_atividades_timeline;
CREATE VIEW public.vw_rel_atividades_timeline
WITH (security_invoker = true)
AS
SELECT
  a.tenant_id,
  a.id,
  a.tipo,
  a.descricao,
  a.feito_por,
  a.feito_por_tipo,
  a.criado_em,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  n.titulo AS negocio_titulo,
  n.codigo AS negocio_codigo
FROM public.hub_atividades a
LEFT JOIN public.hub_leads_crm l ON l.id = a.lead_id
LEFT JOIN public.hub_negocios n ON n.id = a.negocio_id;

DROP VIEW IF EXISTS public.vw_rel_notas_crm;
CREATE VIEW public.vw_rel_notas_crm
WITH (security_invoker = true)
AS
SELECT
  no.tenant_id,
  no.id,
  no.conteudo,
  no.criado_por,
  no.criado_em,
  no.atualizado_em,
  l.nome AS lead_nome,
  n.titulo AS negocio_titulo
FROM public.hub_notas no
LEFT JOIN public.hub_leads_crm l ON l.id = no.lead_id
LEFT JOIN public.hub_negocios n ON n.id = no.negocio_id;

-- ─── Atendimento / WhatsApp ─────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_conversas_atendimento;
CREATE VIEW public.vw_rel_conversas_atendimento
WITH (security_invoker = true)
AS
SELECT
  c.tenant_id,
  c.id,
  c.canal,
  c.status,
  c.ia_ativa,
  c.ia_modelo,
  c.total_mensagens,
  c.ultima_mensagem_em,
  c.ultima_mensagem_preview,
  c.aberta_em,
  c.encerrada_em,
  c.criado_em,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  l.estagio AS lead_estagio,
  p.nome AS pessoa_nome
FROM public.hub_conversas c
LEFT JOIN public.hub_leads_crm l ON l.id = c.lead_id
LEFT JOIN public.hub_pessoas p ON p.id = c.pessoa_id;

DROP VIEW IF EXISTS public.vw_rel_mensagens_detalhe;
CREATE VIEW public.vw_rel_mensagens_detalhe
WITH (security_invoker = true)
AS
SELECT
  m.tenant_id,
  m.id,
  m.remetente,
  m.agente_id,
  m.tipo_conteudo,
  m.conteudo,
  m.whatsapp_status,
  m.email_status,
  m.enviada_em,
  m.criado_em,
  c.canal AS conversa_canal,
  c.status AS conversa_status,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone
FROM public.hub_mensagens m
LEFT JOIN public.hub_conversas c ON c.id = m.conversa_id
LEFT JOIN public.hub_leads_crm l ON l.id = m.lead_id;

DROP VIEW IF EXISTS public.vw_rel_fila_mensagens;
CREATE VIEW public.vw_rel_fila_mensagens
WITH (security_invoker = true)
AS
SELECT
  f.tenant_id,
  f.id,
  f.remetente_numero,
  f.remetente_email,
  f.conteudo,
  f.tipo_midia,
  f.status,
  f.direcao,
  f.canal,
  f.tipo_conversa,
  f.agente_responsavel,
  f.tentativas,
  f.erro,
  f.recebida_em,
  f.enviada_em,
  f.processada_em,
  f.criado_em,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  l.estagio AS lead_estagio
FROM public.hub_fila_mensagens f
LEFT JOIN public.hub_leads_crm l ON l.id = f.lead_id;

DROP VIEW IF EXISTS public.vw_rel_msg_jobs;
CREATE VIEW public.vw_rel_msg_jobs
WITH (security_invoker = true)
AS
SELECT
  j.tenant_id,
  j.id,
  j.canal,
  j.tipo,
  j.status,
  j.prioridade,
  j.attempts,
  j.max_attempts,
  j.telefone,
  j.agente_slug,
  j.run_after,
  j.available_at,
  j.last_error,
  j.created_at,
  j.updated_at,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone
FROM public.hub_msg_jobs j
LEFT JOIN public.hub_leads_crm l ON l.id = j.lead_id;

DROP VIEW IF EXISTS public.vw_rel_atendentes_crm;
CREATE VIEW public.vw_rel_atendentes_crm
WITH (security_invoker = true)
AS
SELECT
  a.tenant_id,
  a.id,
  a.nome,
  a.telefone,
  a.email,
  a.cargo,
  a.agente_slug,
  a.ativo,
  a.criado_em,
  a.atualizado_em
FROM public.hub_atendentes_crm a;

-- ─── IA, memórias, KPIs ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_memorias_lead;
CREATE VIEW public.vw_rel_memorias_lead
WITH (security_invoker = true)
AS
SELECT
  m.tenant_id,
  m.id,
  m.chave,
  m.valor,
  m.nivel_engajamento,
  m.resumo_ia,
  m.confianca,
  m.criado_por,
  m.criado_em,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  l.estagio AS lead_estagio
FROM public.hub_memorias_lead m
JOIN public.hub_leads_crm l ON l.id = m.lead_id;

DROP VIEW IF EXISTS public.vw_rel_agentes_hub;
CREATE VIEW public.vw_rel_agentes_hub
WITH (security_invoker = true)
AS
SELECT
  a.tenant_id,
  a.id,
  a.agente_slug,
  a.nome,
  a.cargo,
  a.area,
  a.nivel,
  a.personalidade,
  a.tom_voz,
  a.modelo_padrao,
  a.modo_operacao,
  a.whatsapp_numero,
  a.email_from,
  a.email_ativo,
  a.motor_ferramentas_habilitado,
  a.ativo,
  a.criado_em,
  a.atualizado_em
FROM public.hub_agente_identidade a;

DROP VIEW IF EXISTS public.vw_rel_prompt_logs;
CREATE VIEW public.vw_rel_prompt_logs
WITH (security_invoker = true)
AS
SELECT
  p.tenant_id,
  p.id,
  p.agente_slug,
  p.modelo_usado,
  p.tokens_input,
  p.tokens_output,
  p.custo_brl,
  p.tempo_resposta_ms,
  p.confianca,
  p.foi_escalado,
  p.motivo_escalada,
  p.criado_em,
  l.nome AS lead_nome
FROM public.hub_prompt_logs p
LEFT JOIN public.hub_leads_crm l ON l.id = p.lead_id;

DROP VIEW IF EXISTS public.vw_rel_acoes_ia;
CREATE VIEW public.vw_rel_acoes_ia
WITH (security_invoker = true)
AS
SELECT
  a.tenant_id,
  a.id,
  a.agente_slug,
  a.tipo,
  a.descricao,
  a.resultado,
  a.tokens_usados,
  a.custo_brl,
  a.sucesso,
  a.erro,
  a.criado_em,
  l.nome AS lead_nome
FROM public.hub_acoes_ia a
LEFT JOIN public.hub_leads_crm l ON l.id = a.lead_id;

DROP VIEW IF EXISTS public.vw_rel_kpis_resultados;
CREATE VIEW public.vw_rel_kpis_resultados
WITH (security_invoker = true)
AS
SELECT
  r.tenant_id,
  r.id,
  r.kpi_slug,
  d.nome AS kpi_nome,
  d.categoria AS kpi_categoria,
  d.unidade AS kpi_unidade,
  r.agente_slug,
  r.valor,
  r.periodo_inicio,
  r.periodo_fim,
  r.amostras,
  r.dentro_da_meta,
  r.nivel_alerta,
  r.criado_em
FROM public.hub_kpis_resultados r
JOIN public.hub_kpis_definicao d ON d.slug = r.kpi_slug;

DROP VIEW IF EXISTS public.vw_rel_kpis_metas;
CREATE VIEW public.vw_rel_kpis_metas
WITH (security_invoker = true)
AS
SELECT
  m.tenant_id,
  m.id,
  m.kpi_slug,
  d.nome AS kpi_nome,
  d.categoria AS kpi_categoria,
  m.agente_slug,
  m.valor_meta,
  m.valor_atencao,
  m.valor_critico,
  m.frequencia,
  m.ativo,
  m.criado_em
FROM public.hub_kpis_metas m
JOIN public.hub_kpis_definicao d ON d.slug = m.kpi_slug;

-- ─── Operação, aprovações, alertas ──────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_aprovacoes;
CREATE VIEW public.vw_rel_aprovacoes
WITH (security_invoker = true)
AS
SELECT
  ap.tenant_id,
  ap.id,
  ap.tipo,
  ap.agente_slug,
  ap.agente_nome,
  ap.descricao,
  ap.status,
  ap.valor_envolvido,
  ap.prazo,
  ap.confianca_ia,
  ap.aprovado_por,
  ap.aprovado_em,
  ap.criado_em,
  l.nome AS lead_nome
FROM public.hub_aprovacoes ap
LEFT JOIN public.hub_leads_crm l ON l.id = ap.lead_id;

DROP VIEW IF EXISTS public.vw_rel_alertas_operacao;
CREATE VIEW public.vw_rel_alertas_operacao
WITH (security_invoker = true)
AS
SELECT
  al.tenant_id,
  al.id,
  al.tipo,
  al.agente_slug,
  al.titulo,
  al.mensagem,
  al.lido,
  al.resolvido,
  al.notificado_whatsapp,
  al.criado_em,
  l.nome AS lead_nome
FROM public.hub_alertas al
LEFT JOIN public.hub_leads_crm l ON l.id = al.lead_id;

-- ─── Marketing, conhecimento, integrações ───────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_metricas_trafego;
CREATE VIEW public.vw_rel_metricas_trafego
WITH (security_invoker = true)
AS
SELECT
  t.tenant_id,
  t.id,
  t.campanha_id,
  t.plataforma,
  t.cpl,
  t.roas,
  t.ctr,
  t.cpa,
  t.impressoes,
  t.cliques,
  t.conversoes,
  t.verba_consumida,
  t.status_campanha,
  t.criado_em
FROM public.hub_metricas_trafego t;

DROP VIEW IF EXISTS public.vw_rel_conhecimento_tenant;
CREATE VIEW public.vw_rel_conhecimento_tenant
WITH (security_invoker = true)
AS
SELECT
  d.tenant_id,
  d.id,
  d.nome_arquivo,
  d.titulo,
  d.mime_type,
  d.tamanho_bytes,
  d.status,
  d.chunks_count,
  d.criado_em,
  d.indexado_em
FROM public.hub_tenant_conhecimento_documento d;

DROP VIEW IF EXISTS public.vw_rel_rag_documentos;
CREATE VIEW public.vw_rel_rag_documentos
WITH (security_invoker = true)
AS
SELECT
  d.tenant_id,
  d.id,
  d.agente_slug,
  d.nome_arquivo,
  d.mime_type,
  d.tamanho_bytes,
  d.status,
  d.origem,
  d.criado_em,
  d.atualizado_em
FROM public.hub_agente_rag_documentos d;

DROP VIEW IF EXISTS public.vw_rel_integracoes_hub;
CREATE VIEW public.vw_rel_integracoes_hub
WITH (security_invoker = true)
AS
SELECT
  i.tenant_id,
  i.id,
  i.integracao_id,
  i.nome,
  i.status,
  i.ativo,
  i.criado_em,
  i.atualizado_em
FROM public.hub_integracoes i;

DROP VIEW IF EXISTS public.vw_rel_ferramentas_externas;
CREATE VIEW public.vw_rel_ferramentas_externas
WITH (security_invoker = true)
AS
SELECT
  f.tenant_id,
  f.id,
  f.ferramenta_key,
  f.titulo,
  f.descricao_curta,
  f.metodo_http,
  f.politica,
  f.ativo,
  f.criado_em
FROM public.hub_ferramentas_externas f;

-- ─── Sistema ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vw_rel_auditoria_sistema;
CREATE VIEW public.vw_rel_auditoria_sistema
WITH (security_invoker = true)
AS
SELECT
  a.tenant_id,
  a.id,
  a.actor_nome,
  a.actor_email,
  a.acao,
  a.entidade,
  a.entidade_id,
  a.resumo,
  a.criado_em
FROM public.hub_auditoria_sistema a;

DROP VIEW IF EXISTS public.vw_rel_contatos_notificacao;
CREATE VIEW public.vw_rel_contatos_notificacao
WITH (security_invoker = true)
AS
SELECT
  c.tenant_id,
  c.id,
  c.nome,
  c.telefone,
  c.email,
  c.cargo,
  c.ativo,
  c.receber_novo_lead,
  c.receber_aprovacao,
  c.canal,
  c.criado_em
FROM public.hub_contatos_notificacao c;

DROP VIEW IF EXISTS public.vw_rel_users_acesso;
CREATE VIEW public.vw_rel_users_acesso
WITH (security_invoker = true)
AS
SELECT
  u.tenant_id,
  u.id,
  u.email,
  u.name,
  u.phone,
  u.role,
  u.status,
  u.created_at,
  c.nome AS cargo_acesso,
  c.slug AS cargo_slug
FROM public.users u
LEFT JOIN public.hub_acesso_cargos c ON c.id = u.access_role_id;

-- ─── Financeiro (tabelas opcionais — só cria se existirem) ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_receber') THEN
    EXECUTE $v$
      DROP VIEW IF EXISTS public.vw_rel_contas_receber;
      CREATE VIEW public.vw_rel_contas_receber
      WITH (security_invoker = true)
      AS SELECT tenant_id, id, descricao, valor, vencimento, status, criado_em
      FROM public.hub_contas_receber;
    $v$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar') THEN
    EXECUTE $v$
      DROP VIEW IF EXISTS public.vw_rel_contas_pagar;
      CREATE VIEW public.vw_rel_contas_pagar
      WITH (security_invoker = true)
      AS SELECT tenant_id, id, descricao, valor, vencimento, status, criado_em
      FROM public.hub_contas_pagar;
    $v$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_receber') THEN
    EXECUTE $v$
      DROP VIEW IF EXISTS public.vw_rel_fluxo_caixa;
      CREATE VIEW public.vw_rel_fluxo_caixa
      WITH (security_invoker = true)
      AS
      SELECT tenant_id, 'receber'::text AS tipo, id, descricao, valor, vencimento, status, criado_em
      FROM public.hub_contas_receber
      UNION ALL
      SELECT tenant_id, 'pagar'::text AS tipo, id, descricao, valor, vencimento, status, criado_em
      FROM public.hub_contas_pagar;
    $v$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_imoveis') THEN
    EXECUTE $v$
      DROP VIEW IF EXISTS public.vw_rel_imoveis_captacao;
      CREATE VIEW public.vw_rel_imoveis_captacao
      WITH (security_invoker = true)
      AS SELECT tenant_id, id, codigo, titulo, tipo, status, valor, cidade, estado, criado_em
      FROM public.hub_imoveis;
    $v$;
  END IF;
END $$;

-- Grants PostgREST
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'vw_rel_leads_enriquecidos',
    'vw_rel_negocios_pipeline',
    'vw_rel_pessoas_cadastro',
    'vw_rel_empresas_cadastro',
    'vw_rel_atividades_timeline',
    'vw_rel_notas_crm',
    'vw_rel_conversas_atendimento',
    'vw_rel_mensagens_detalhe',
    'vw_rel_fila_mensagens',
    'vw_rel_msg_jobs',
    'vw_rel_atendentes_crm',
    'vw_rel_memorias_lead',
    'vw_rel_agentes_hub',
    'vw_rel_prompt_logs',
    'vw_rel_acoes_ia',
    'vw_rel_kpis_resultados',
    'vw_rel_kpis_metas',
    'vw_rel_aprovacoes',
    'vw_rel_alertas_operacao',
    'vw_rel_metricas_trafego',
    'vw_rel_conhecimento_tenant',
    'vw_rel_rag_documentos',
    'vw_rel_integracoes_hub',
    'vw_rel_ferramentas_externas',
    'vw_rel_auditoria_sistema',
    'vw_rel_contatos_notificacao',
    'vw_rel_users_acesso',
    'vw_rel_contas_receber',
    'vw_rel_contas_pagar',
    'vw_rel_fluxo_caixa',
    'vw_rel_imoveis_captacao'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = v
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', v);
    END IF;
  END LOOP;
END $$;
