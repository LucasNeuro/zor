-- Seed estágios PDF (Funil Operacional) em hub_pipeline_estagios — aditivo, não remove slugs legados.

-- ─── Leads global: 8 etapas PDF ───
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
    VALUES ('leads-global', 'Leads — Funil operacional', 'lead', NULL, 0)
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
    ('convertido_negocio',    'Convertido em negócio',   '#22C55E', 5,  'ganho'),
    ('perdido',               'Perdido',                 '#EF4444', 6,  'perdido'),
    ('spam_invalido',         'Spam ou inválido',        '#9CA3AF', 7,  'perdido')
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

-- ─── Negócios por mercado (etapas PDF) ───
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
        ('imb', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('imb', 'contato_validado', 'Contato validado', 'aberto'),
        ('imb', 'encaminhado_corretor', 'Encaminhado ao corretor', 'aberto'),
        ('imb', 'atendimento_corretor', 'Em atendimento pelo corretor', 'aberto'),
        ('imb', 'imovel_selecionado_captado', 'Imóvel selecionado ou captado', 'aberto'),
        ('imb', 'visita_agendada', 'Visita ou avaliação agendada', 'aberto'),
        ('imb', 'proposta_negociacao', 'Proposta em negociação', 'aberto'),
        ('imb', 'documentacao', 'Documentação em andamento', 'aberto'),
        ('imb', 'fechado_ganho', 'Fechado ganho', 'ganho'),
        ('imb', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('arq', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('arq', 'contato_validado', 'Contato validado', 'aberto'),
        ('arq', 'briefing_inicial', 'Briefing inicial', 'aberto'),
        ('arq', 'reuniao_agendada', 'Reunião agendada', 'aberto'),
        ('arq', 'briefing_completo', 'Briefing completo', 'aberto'),
        ('arq', 'proposta_elaboracao', 'Proposta em elaboração', 'aberto'),
        ('arq', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('arq', 'negociacao', 'Negociação', 'aberto'),
        ('arq', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('arq', 'fechado_ganho', 'Fechado ganho', 'ganho'),
        ('arq', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('rfm', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('rfm', 'contato_validado', 'Contato validado', 'aberto'),
        ('rfm', 'escopo_inicial', 'Escopo inicial recebido', 'aberto'),
        ('rfm', 'visita_agendada', 'Visita técnica agendada', 'aberto'),
        ('rfm', 'levantamento', 'Levantamento realizado', 'aberto'),
        ('rfm', 'orcamento_elaboracao', 'Orçamento em elaboração', 'aberto'),
        ('rfm', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('rfm', 'negociacao', 'Negociação', 'aberto'),
        ('rfm', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('rfm', 'obra_criada', 'Obra criada', 'ganho'),
        ('rfm', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('eng', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('eng', 'contato_validado', 'Contato validado', 'aberto'),
        ('eng', 'demanda_entendida', 'Demanda técnica entendida', 'aberto'),
        ('eng', 'documentos_solicitados', 'Documentos solicitados', 'aberto'),
        ('eng', 'analise_tecnica', 'Análise técnica', 'aberto'),
        ('eng', 'visita_tecnica', 'Visita técnica, se necessário', 'aberto'),
        ('eng', 'proposta_tecnica', 'Proposta técnica', 'aberto'),
        ('eng', 'proposta_comercial', 'Proposta comercial', 'aberto'),
        ('eng', 'negociacao', 'Negociação', 'aberto'),
        ('eng', 'contrato_aprovado', 'Contrato aprovado', 'aberto'),
        ('eng', 'projeto_obra_criado', 'Projeto ou obra criado', 'ganho'),
        ('eng', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('mrc', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('mrc', 'contato_validado', 'Contato validado', 'aberto'),
        ('mrc', 'ambiente_identificado', 'Ambiente identificado', 'aberto'),
        ('mrc', 'medidas_solicitadas', 'Medidas ou projeto solicitado', 'aberto'),
        ('mrc', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('mrc', 'cotacao', 'Cotação em andamento', 'aberto'),
        ('mrc', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('mrc', 'negociacao', 'Negociação', 'aberto'),
        ('mrc', 'pedido_aprovado', 'Pedido aprovado', 'aberto'),
        ('mrc', 'producao_entrega', 'Produção ou entrega criada', 'ganho'),
        ('mrc', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('srv', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('srv', 'contato_validado', 'Contato validado', 'aberto'),
        ('srv', 'servico_identificado', 'Serviço identificado', 'aberto'),
        ('srv', 'fotos_solicitadas', 'Fotos ou informações solicitadas', 'aberto'),
        ('srv', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('srv', 'cotacao', 'Cotação em andamento', 'aberto'),
        ('srv', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('srv', 'execucao_agendada', 'Execução agendada', 'aberto'),
        ('srv', 'servico_fechado', 'Serviço fechado', 'ganho'),
        ('srv', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('pro', 'novo_negocio', 'Novo negócio', 'aberto'),
        ('pro', 'contato_validado', 'Contato validado', 'aberto'),
        ('pro', 'produto_identificado', 'Produto identificado', 'aberto'),
        ('pro', 'especificacao_recebida', 'Quantidade ou especificação recebida', 'aberto'),
        ('pro', 'fornecedor_sugerido', 'Fornecedor sugerido', 'aberto'),
        ('pro', 'cotacao', 'Cotação em andamento', 'aberto'),
        ('pro', 'proposta_enviada', 'Proposta enviada', 'aberto'),
        ('pro', 'pedido_aprovado', 'Pedido aprovado', 'aberto'),
        ('pro', 'entrega_andamento', 'Entrega em andamento', 'ganho'),
        ('pro', 'fechado_perdido', 'Fechado perdido', 'perdido'),
        ('for', 'cadastro_recebido', 'Cadastro recebido', 'aberto'),
        ('for', 'dados_validados', 'Dados mínimos validados', 'aberto'),
        ('for', 'documentos_solicitados', 'Documentos solicitados', 'aberto'),
        ('for', 'documentacao_pendente', 'Documentação pendente', 'aberto'),
        ('for', 'em_analise', 'Em análise', 'aberto'),
        ('for', 'entrevista', 'Entrevista ou reunião', 'aberto'),
        ('for', 'avaliacao_tecnica', 'Avaliação técnica', 'aberto'),
        ('for', 'avaliacao_comercial', 'Avaliação comercial', 'aberto'),
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

-- ─── Migrar valores em hub_leads_crm para slugs PDF ───
ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS estagio_funil TEXT;

-- CHECK legado (novo, qualificado, ganho…) bloqueia slugs PDF; validação na app + hub_pipeline_estagios
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
