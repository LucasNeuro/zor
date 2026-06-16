-- Catálogo dinâmico de serviços/produtos por tenant (origem: Conhecimento da empresa).
-- Negócios no lead referenciam o catálogo; financeiro espelha em hub_contas_receber.

-- ─── Catálogo de serviços do tenant ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hub_tenant_servicos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_referencia NUMERIC(12, 2),
  moeda TEXT NOT NULL DEFAULT 'BRL',
  tipo TEXT NOT NULL DEFAULT 'servico'
    CHECK (tipo IN ('servico', 'produto', 'pacote', 'outro')),
  documento_origem_id UUID
    REFERENCES public.hub_tenant_conhecimento_documento(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'conhecimento_ia', 'importado')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_tenant_servicos_catalogo_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_servicos_catalogo_tenant_ativo
  ON public.hub_tenant_servicos_catalogo (tenant_id, ativo, ordem, nome);

COMMENT ON TABLE public.hub_tenant_servicos_catalogo IS
  'Catálogo de serviços/produtos da empresa (tenant). Alimentado por Conhecimento (IA) ou cadastro manual. Usado no dropdown de negócios no lead.';

-- Log de sincronização a partir do Conhecimento (auditoria leve)
CREATE TABLE IF NOT EXISTS public.hub_tenant_servicos_catalogo_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  itens_inseridos INTEGER NOT NULL DEFAULT 0,
  itens_atualizados INTEGER NOT NULL DEFAULT 0,
  itens_desativados INTEGER NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'conhecimento_ia',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_servicos_sync_tenant
  ON public.hub_tenant_servicos_catalogo_sync (tenant_id, criado_em DESC);

-- ─── Negócios: vínculo ao catálogo (vários negócios por lead) ─────────────────

ALTER TABLE public.hub_negocios
  ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID
    REFERENCES public.hub_tenant_servicos_catalogo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hub_negocios_servico_catalogo
  ON public.hub_negocios (servico_catalogo_id)
  WHERE servico_catalogo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hub_negocios_lead_id
  ON public.hub_negocios (lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.hub_negocios.servico_catalogo_id IS
  'Serviço/produto do catálogo do tenant (substitui mercado/rumo fixo Obra10 na UI Waje).';

-- Colunas usadas pelo trigger financeiro (schemas antigos podem não tê-las)
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- prefixo_mercado legado: tornar opcional com default GRL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'prefixo_mercado'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado DROP NOT NULL;
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado SET DEFAULT 'GRL';
    UPDATE public.hub_negocios SET prefixo_mercado = 'GRL' WHERE prefixo_mercado IS NULL OR btrim(prefixo_mercado) = '';
  END IF;
END $$;

-- ─── Financeiro: enriquecer contas a receber ────────────────────────────────

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL;

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID
    REFERENCES public.hub_tenant_servicos_catalogo(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_contas_receber_negocio_unique
  ON public.hub_contas_receber (negocio_id)
  WHERE negocio_id IS NOT NULL;

-- ─── Sincronizar conta a receber quando negócio tem valor ───────────────────

CREATE OR REPLACE FUNCTION public.hub_sync_conta_receber_de_negocio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor NUMERIC(12, 2);
  v_descricao TEXT;
  v_vencimento DATE;
  v_status TEXT;
  v_tenant UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.hub_contas_receber WHERE negocio_id = OLD.id;
    RETURN OLD;
  END IF;

  v_tenant := NEW.tenant_id;
  IF v_tenant IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT l.tenant_id INTO v_tenant FROM public.hub_leads_crm l WHERE l.id = NEW.lead_id;
  END IF;

  IF NEW.status IN ('fechado_perdido', 'cancelado') THEN
    UPDATE public.hub_contas_receber
    SET status = 'cancelado', atualizado_em = NOW()
    WHERE negocio_id = NEW.id AND status = 'pendente';
    RETURN NEW;
  END IF;

  v_valor := COALESCE(NEW.valor_fechado, NEW.valor_estimado);
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RETURN NEW;
  END IF;

  v_descricao := COALESCE(NULLIF(btrim(NEW.titulo), ''), 'Negócio CRM');
  v_vencimento := COALESCE(NEW.data_previsao_fechamento, (CURRENT_DATE + INTERVAL '30 days')::date);
  v_status := 'pendente';

  INSERT INTO public.hub_contas_receber (
    descricao, valor, vencimento, status, negocio_id, lead_id, servico_catalogo_id, tenant_id
  )
  VALUES (
    v_descricao, v_valor, v_vencimento, v_status, NEW.id, NEW.lead_id, NEW.servico_catalogo_id, v_tenant
  )
  ON CONFLICT (negocio_id) WHERE negocio_id IS NOT NULL
  DO UPDATE SET
    descricao = EXCLUDED.descricao,
    valor = EXCLUDED.valor,
    vencimento = EXCLUDED.vencimento,
    status = EXCLUDED.status,
    lead_id = EXCLUDED.lead_id,
    servico_catalogo_id = EXCLUDED.servico_catalogo_id,
    tenant_id = COALESCE(EXCLUDED.tenant_id, public.hub_contas_receber.tenant_id),
    atualizado_em = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hub_negocios_sync_conta_receber ON public.hub_negocios;
CREATE TRIGGER hub_negocios_sync_conta_receber
  AFTER INSERT OR UPDATE OF titulo, status, valor_estimado, valor_fechado,
    data_previsao_fechamento, lead_id, servico_catalogo_id, tenant_id
  ON public.hub_negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_sync_conta_receber_de_negocio();

-- ─── Upsert em lote (API de sync a partir do Conhecimento) ──────────────────

CREATE OR REPLACE FUNCTION public.hub_upsert_servicos_catalogo_batch(
  p_tenant_id UUID,
  p_itens JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_slug TEXT;
  v_nome TEXT;
  v_desc TEXT;
  v_preco NUMERIC(12, 2);
  v_inseridos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_slugs TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'p_itens deve ser um array JSON';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_nome := btrim(COALESCE(v_item ->> 'nome', ''));
    IF v_nome = '' THEN
      CONTINUE;
    END IF;
    v_slug := lower(regexp_replace(v_nome, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-|-$)', '', 'g');
    IF v_slug = '' THEN
      v_slug := 'item-' || substr(md5(v_nome), 1, 8);
    END IF;
    v_desc := NULLIF(btrim(COALESCE(v_item ->> 'descricao', '')), '');
    v_preco := NULL;
    IF (v_item ->> 'preco_referencia') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_preco := (v_item ->> 'preco_referencia')::numeric;
    END IF;
    v_slugs := array_append(v_slugs, v_slug);

    INSERT INTO public.hub_tenant_servicos_catalogo (
      tenant_id, slug, nome, descricao, preco_referencia, origem, ativo, ordem, metadata
    )
    VALUES (
      p_tenant_id,
      v_slug,
      v_nome,
      v_desc,
      v_preco,
      COALESCE(NULLIF(v_item ->> 'origem', ''), 'conhecimento_ia'),
      true,
      COALESCE((v_item ->> 'ordem')::integer, 0),
      COALESCE(v_item -> 'metadata', '{}'::jsonb)
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = COALESCE(EXCLUDED.descricao, public.hub_tenant_servicos_catalogo.descricao),
      preco_referencia = COALESCE(EXCLUDED.preco_referencia, public.hub_tenant_servicos_catalogo.preco_referencia),
      origem = EXCLUDED.origem,
      ativo = true,
      ordem = EXCLUDED.ordem,
      atualizado_em = NOW();

    IF xmax = 0 THEN
      v_inseridos := v_inseridos + 1;
    ELSE
      v_atualizados := v_atualizados + 1;
    END IF;
  END LOOP;

  INSERT INTO public.hub_tenant_servicos_catalogo_sync (
    tenant_id, itens_inseridos, itens_atualizados, metadata
  )
  VALUES (
    p_tenant_id,
    v_inseridos,
    v_atualizados,
    jsonb_build_object('slugs', v_slugs)
  );

  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'total', v_inseridos + v_atualizados
  );
END;
$$;

-- ─── Views de relatório ─────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.vw_rel_servicos_catalogo;
CREATE VIEW public.vw_rel_servicos_catalogo
WITH (security_invoker = true)
AS
SELECT
  s.tenant_id,
  s.id,
  s.slug,
  s.nome,
  s.descricao,
  s.preco_referencia,
  s.moeda,
  s.tipo,
  s.origem,
  s.ativo,
  s.ordem,
  s.criado_em,
  s.atualizado_em,
  d.nome_arquivo AS documento_origem
FROM public.hub_tenant_servicos_catalogo s
LEFT JOIN public.hub_tenant_conhecimento_documento d ON d.id = s.documento_origem_id;

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
  n.lead_id,
  n.servico_catalogo_id,
  sc.nome AS servico_nome,
  sc.preco_referencia AS servico_preco_referencia,
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
LEFT JOIN public.hub_tenant_servicos_catalogo sc ON sc.id = n.servico_catalogo_id
LEFT JOIN public.hub_leads_crm l ON l.id = n.lead_id
LEFT JOIN public.hub_pessoas p ON p.id = n.pessoa_id
LEFT JOIN public.hub_empresas e ON e.id = n.empresa_id
LEFT JOIN public.hub_pipelines pl ON pl.id = n.pipeline_id;

-- Recriar fluxo de caixa se tabelas financeiras existirem
DO $$
BEGIN
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
END $$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.hub_tenant_servicos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_tenant_servicos_catalogo_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_tenant_servicos_catalogo_service ON public.hub_tenant_servicos_catalogo;
CREATE POLICY hub_tenant_servicos_catalogo_service ON public.hub_tenant_servicos_catalogo
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hub_tenant_servicos_catalogo_sync_service ON public.hub_tenant_servicos_catalogo_sync;
CREATE POLICY hub_tenant_servicos_catalogo_sync_service ON public.hub_tenant_servicos_catalogo_sync
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.hub_tenant_servicos_catalogo TO anon, authenticated, service_role;
GRANT ALL ON public.hub_tenant_servicos_catalogo_sync TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_rel_servicos_catalogo TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hub_upsert_servicos_catalogo_batch(UUID, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
