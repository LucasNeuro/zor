-- Seed adicional: pipelines por mercado (lead e negócio) com os 8 estágios padrão.

DO $$
DECLARE
  sigla TEXT;
  nome TEXT;
  pid UUID;
BEGIN
  FOR sigla, nome IN
    SELECT * FROM (
      VALUES
        ('IMB', 'Imobiliário'),
        ('ARQ', 'Arquitetura'),
        ('RFM', 'Reforma e obra'),
        ('MRC', 'Marcenaria e móveis'),
        ('ENG', 'Engenharia civil'),
        ('SRV', 'Serviços'),
        ('PRO', 'Produtos e materiais'),
        ('FOR', 'Fornecedor / homologação')
    ) AS mercados(sigla, nome)
  LOOP
    INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
    SELECT LOWER('leads-' || sigla), 'Leads — ' || nome, 'lead', sigla, 10
    WHERE NOT EXISTS (
      SELECT 1 FROM public.hub_pipelines
      WHERE slug = LOWER('leads-' || sigla) AND tenant_id IS NULL
    );

    INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
    SELECT LOWER('negocios-' || sigla), 'Negócios — ' || nome, 'negocio', sigla, 20
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
        ('ganho',        '✓ Ganhos',     '#22C55E', 6, 'ganho'),
        ('perdido',      '✗ Perdidos',   '#EF4444', 7, 'perdido')
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
        ('ganho',        '✓ Ganhos',     '#22C55E', 6, 'ganho'),
        ('perdido',      '✗ Perdidos',   '#EF4444', 7, 'perdido')
      ) AS v(slug, label, cor, ordem, tipo_fecho)
      ON CONFLICT (pipeline_id, slug) DO NOTHING;
    END IF;
  END LOOP;
END $$;
