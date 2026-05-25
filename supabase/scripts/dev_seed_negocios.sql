-- DEV ONLY
-- Cria 4 negócios de teste para validar o layout da página /crm/negocios.
-- Seguro para reexecutar: apaga apenas códigos "NEG-DEV-%" antes de recriar.
-- Compatível com bases que ainda não receberam todas as migrações novas.

BEGIN;

DO $$
DECLARE
  default_tenant CONSTANT uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  has_negocio_tenant boolean;
  has_negocio_pipeline boolean;
  has_vinculos_table boolean;
  has_vinculos_tenant boolean;
  has_pipelines_table boolean;
  has_legacy_etapa_chk boolean;
  has_comissao_calculada boolean;
  comissao_is_generated boolean;
  pipeline_id_base uuid := NULL;
  insert_cols text;
  select_cols text;
  insert_sql text;
  inserted_sql text;
  vinculo_cols text;
  vinculo_sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_negocios'
      AND column_name = 'tenant_id'
  ) INTO has_negocio_tenant;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_negocios'
      AND column_name = 'pipeline_id'
  ) INTO has_negocio_pipeline;

  SELECT to_regclass('public.hub_negocio_vinculos') IS NOT NULL
  INTO has_vinculos_table;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_negocio_vinculos'
      AND column_name = 'tenant_id'
  ) INTO has_vinculos_tenant;

  SELECT to_regclass('public.hub_pipelines') IS NOT NULL
  INTO has_pipelines_table;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hub_negocios_etapa_chk'
  ) INTO has_legacy_etapa_chk;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_negocios'
      AND column_name = 'comissao_calculada'
  ) INTO has_comissao_calculada;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_negocios'
      AND column_name = 'comissao_calculada'
      AND is_generated <> 'NEVER'
  ) INTO comissao_is_generated;

  IF has_vinculos_table THEN
    DELETE FROM public.hub_negocio_vinculos
    WHERE negocio_id IN (
      SELECT id
      FROM public.hub_negocios
      WHERE codigo LIKE 'NEG-DEV-%'
    );
  END IF;

  DELETE FROM public.hub_negocios
  WHERE codigo LIKE 'NEG-DEV-%';

  IF has_pipelines_table AND has_negocio_pipeline THEN
    EXECUTE $sql$
      SELECT p.id
      FROM public.hub_pipelines p
      WHERE p.tipo = 'negocio'
        AND p.ativo = true
        AND p.mercado_sigla IS NULL
      ORDER BY
        CASE WHEN p.slug = 'negocios-global' THEN 0 ELSE 1 END,
        p.ordem,
        p.nome
      LIMIT 1
    $sql$
    INTO pipeline_id_base;
  END IF;

  DROP TABLE IF EXISTS tmp_dev_negocios_payload;
  DROP TABLE IF EXISTS tmp_dev_negocios_inserted;

  CREATE TEMP TABLE tmp_dev_negocios_payload ON COMMIT DROP AS
  WITH templates AS (
    SELECT *
    FROM (
      VALUES
        (1, 'novo',         'aberto',         'Negócio DEV · Entrada',      42000::numeric, NULL::numeric, 3.50::numeric, CURRENT_DATE + 7),
        (2, 'qualificando', 'aberto',         'Negócio DEV · Qualificação', 68500::numeric, NULL::numeric, 4.20::numeric, CURRENT_DATE + 12),
        (3, 'proposta',     'em_negociacao',  'Negócio DEV · Proposta',    128000::numeric, NULL::numeric, 5.00::numeric, CURRENT_DATE + 18),
        (4, 'ganho',        'fechado_ganho',  'Negócio DEV · Fechado',      96000::numeric, 94000::numeric, 4.75::numeric, CURRENT_DATE - 1)
    ) AS t(n, etapa_key, status, titulo_base, valor_estimado, valor_fechado, percentual_comissao, data_previsao_fechamento)
  ),
  templates_normalized AS (
    SELECT
      n,
      CASE
        WHEN has_legacy_etapa_chk AND etapa_key = 'novo' THEN 'briefing'
        WHEN has_legacy_etapa_chk AND etapa_key = 'qualificando' THEN 'match'
        WHEN has_legacy_etapa_chk AND etapa_key = 'proposta' THEN 'sit-down'
        WHEN has_legacy_etapa_chk AND etapa_key = 'ganho' THEN 'concluido'
        ELSE etapa_key
      END AS etapa,
      status,
      titulo_base,
      valor_estimado,
      valor_fechado,
      percentual_comissao,
      data_previsao_fechamento
    FROM templates
  ),
  leads_base AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY l.criado_em NULLS LAST, l.nome, l.id) AS rn,
      l.id AS lead_id,
      l.pessoa_id,
      l.codigo AS lead_codigo,
      l.nome AS lead_nome,
      COALESCE(
        NULLIF(UPPER(COALESCE(l.metadata ->> 'mercado_principal', '')), ''),
        'IMB'
      ) AS prefixo_mercado,
      COALESCE(l.valor_estimado, 0) AS lead_valor_estimado
    FROM public.hub_leads_crm l
    WHERE l.codigo LIKE 'LED-DEV-%'
    ORDER BY l.criado_em NULLS LAST, l.nome, l.id
    LIMIT 4
  )
  SELECT
    t.n,
    'NEG-DEV-' || LPAD(t.n::text, 2, '0') AS codigo,
    CASE
      WHEN lb.lead_nome IS NOT NULL THEN t.titulo_base || ' · ' || lb.lead_nome
      ELSE t.titulo_base
    END AS titulo,
    'Seed DEV do pipeline de negócios.' AS descricao,
    COALESCE(lb.prefixo_mercado, 'IMB') AS prefixo_mercado,
    lb.lead_id,
    lb.pessoa_id,
    NULLIF(GREATEST(COALESCE(lb.lead_valor_estimado, 0), t.valor_estimado), 0) AS valor_estimado,
    t.valor_fechado,
    t.percentual_comissao,
    ROUND(
      COALESCE(
        t.valor_fechado,
        GREATEST(COALESCE(lb.lead_valor_estimado, 0), t.valor_estimado)
      ) * (t.percentual_comissao / 100),
      2
    ) AS comissao_seed,
    t.status,
    t.etapa,
    t.data_previsao_fechamento,
    pipeline_id_base AS pipeline_id,
    default_tenant AS tenant_id,
    NOW() - ((5 - t.n) * INTERVAL '4 hours') AS criado_em,
    NOW() - ((5 - t.n) * INTERVAL '37 minutes') AS atualizado_em
  FROM templates_normalized t
  LEFT JOIN leads_base lb ON lb.rn = t.n;

  insert_cols := 'codigo, titulo, descricao, prefixo_mercado, lead_id, pessoa_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, data_previsao_fechamento, criado_em, atualizado_em';
  select_cols := 'codigo, titulo, descricao, prefixo_mercado, lead_id, pessoa_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, data_previsao_fechamento, criado_em, atualizado_em';

  IF has_comissao_calculada AND NOT comissao_is_generated THEN
    insert_cols := insert_cols || ', comissao_calculada';
    select_cols := select_cols || ', comissao_seed';
  ELSIF comissao_is_generated THEN
    RAISE NOTICE 'hub_negocios.comissao_calculada é coluna gerada: seed não enviará esse campo no INSERT.';
  END IF;

  IF has_negocio_pipeline THEN
    insert_cols := insert_cols || ', pipeline_id';
    select_cols := select_cols || ', pipeline_id';
  ELSE
    RAISE NOTICE 'hub_negocios.pipeline_id ausente: seed seguirá sem pipeline_id.';
  END IF;

  IF has_negocio_tenant THEN
    insert_cols := insert_cols || ', tenant_id';
    select_cols := select_cols || ', tenant_id';
  ELSE
    RAISE NOTICE 'hub_negocios.tenant_id ausente: seed seguirá sem tenant_id.';
  END IF;

  IF has_legacy_etapa_chk THEN
    RAISE NOTICE 'Constraint antiga de etapa detectada em hub_negocios; seed usará etapas legadas.';
  END IF;

  insert_sql := format(
    'INSERT INTO public.hub_negocios (%s)
     SELECT %s
     FROM tmp_dev_negocios_payload;',
    insert_cols,
    select_cols
  );

  EXECUTE insert_sql;

  inserted_sql := format(
    'CREATE TEMP TABLE tmp_dev_negocios_inserted ON COMMIT DROP AS
     SELECT
       n.id,
       n.codigo,
       n.lead_id,
       n.pessoa_id,
       %s AS tenant_id
     FROM public.hub_negocios n
     WHERE n.codigo LIKE ''NEG-DEV-%%'';',
    CASE
      WHEN has_negocio_tenant THEN 'n.tenant_id'
      ELSE 'NULL::uuid'
    END
  );

  EXECUTE inserted_sql;

  IF has_vinculos_table THEN
    vinculo_cols := 'negocio_id, entidade_tipo, entidade_id, codigo_rastreio, papel';

    IF has_vinculos_tenant THEN
      vinculo_cols := vinculo_cols || ', tenant_id';
    END IF;

    vinculo_sql := format(
      'INSERT INTO public.hub_negocio_vinculos (%s)
       SELECT
         i.id,
         ''lead'',
         i.lead_id,
         l.codigo,
         ''lead_origem''%s
       FROM tmp_dev_negocios_inserted i
       JOIN public.hub_leads_crm l ON l.id = i.lead_id
       WHERE i.lead_id IS NOT NULL
       UNION ALL
       SELECT
         i.id,
         ''pessoa'',
         i.pessoa_id,
         p.codigo,
         ''cliente''%s
       FROM tmp_dev_negocios_inserted i
       JOIN public.hub_pessoas p ON p.id = i.pessoa_id
       WHERE i.pessoa_id IS NOT NULL;',
      vinculo_cols,
      CASE WHEN has_vinculos_tenant THEN ', i.tenant_id' ELSE '' END,
      CASE WHEN has_vinculos_tenant THEN ', i.tenant_id' ELSE '' END
    );

    EXECUTE vinculo_sql;
  ELSE
    RAISE NOTICE 'Tabela hub_negocio_vinculos ausente: seed criará os negócios sem vínculos.';
  END IF;
END $$;

COMMIT;

-- Como usar:
-- 1) Executa depois das migrações e do seed de leads.
-- 2) Recarrega /crm/negocios.
-- 3) Para limpar, roda:
--    DELETE FROM public.hub_negocio_vinculos
--    WHERE negocio_id IN (SELECT id FROM public.hub_negocios WHERE codigo LIKE 'NEG-DEV-%');
--    DELETE FROM public.hub_negocios WHERE codigo LIKE 'NEG-DEV-%';
