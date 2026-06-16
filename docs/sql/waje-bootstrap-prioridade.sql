-- =============================================================================
-- Waje — bootstrap prioritário (negócios + financeiro + catálogo + views)
-- Execute no Supabase: SQL Editor → colar tudo → Run
-- Depois: Settings → API → Reload schema
--
-- Ordem embutida:
--   0) hub_negocios (criar negócio no lead)
--   1) Tabelas financeiras (hub_contas_pagar / hub_contas_receber)
--   2) Catálogo de serviços, vínculo em negócios, trigger → conta a receber
--   3) Views de relatório financeiro
-- =============================================================================

-- ─── 0) Negócios CRM ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.hub_negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  prefixo_mercado TEXT DEFAULT 'GRL',
  lead_id UUID,
  pessoa_id UUID,
  empresa_id UUID,
  pipeline_id UUID,
  valor_estimado NUMERIC(12, 2),
  valor_fechado NUMERIC(12, 2),
  percentual_comissao NUMERIC(5, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  etapa TEXT NOT NULL DEFAULT 'novo',
  data_previsao_fechamento DATE,
  data_entrada DATE,
  data_entrega DATE,
  data_fechamento DATE,
  motivo_perda TEXT,
  proxima_acao TEXT,
  tenant_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS prefixo_mercado TEXT DEFAULT 'GRL';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pessoa_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS empresa_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS pipeline_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS percentual_comissao NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'novo';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS proxima_acao TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_etapa_chk;
ALTER TABLE public.hub_negocios DROP CONSTRAINT IF EXISTS hub_negocios_status_chk;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'titulo'
  ) THEN
    UPDATE public.hub_negocios SET titulo = 'Negócio' WHERE titulo IS NULL OR btrim(titulo) = '';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'prefixo_mercado'
  ) THEN
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado DROP NOT NULL;
    ALTER TABLE public.hub_negocios ALTER COLUMN prefixo_mercado SET DEFAULT 'GRL';
    UPDATE public.hub_negocios SET prefixo_mercado = 'GRL' WHERE prefixo_mercado IS NULL OR btrim(prefixo_mercado) = '';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'etapa'
  ) THEN
    UPDATE public.hub_negocios SET etapa = 'novo' WHERE etapa IN ('briefing', 'match', 'sit-down', 'sit_down', 'concluido');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hub_negocios_codigo_unique
  ON public.hub_negocios (codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

CREATE INDEX IF NOT EXISTS idx_hub_negocios_etapa ON public.hub_negocios (etapa);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_status ON public.hub_negocios (status);
CREATE INDEX IF NOT EXISTS idx_hub_negocios_tenant ON public.hub_negocios (tenant_id);

DROP TRIGGER IF EXISTS hub_negocios_ts ON public.hub_negocios;
CREATE TRIGGER hub_negocios_ts
  BEFORE UPDATE ON public.hub_negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_negocios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_negocios_anon ON public.hub_negocios;
DROP POLICY IF EXISTS hub_negocios_service ON public.hub_negocios;
CREATE POLICY hub_negocios_service ON public.hub_negocios FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.hub_negocios TO anon, authenticated, service_role;

-- ─── 1) Financeiro base ─────────────────────────────────────────────────────

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

-- ─── 2) Catálogo + negócios + sync financeiro ───────────────────────────────

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

ALTER TABLE public.hub_negocios
  ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID
    REFERENCES public.hub_tenant_servicos_catalogo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hub_negocios_servico_catalogo
  ON public.hub_negocios (servico_catalogo_id)
  WHERE servico_catalogo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hub_negocios_lead_id
  ON public.hub_negocios (lead_id)
  WHERE lead_id IS NOT NULL;

-- Colunas usadas pelo trigger financeiro (schemas antigos podem não tê-las)
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;

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

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL;

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID
    REFERENCES public.hub_tenant_servicos_catalogo(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_contas_receber_negocio_unique
  ON public.hub_contas_receber (negocio_id)
  WHERE negocio_id IS NOT NULL;

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
  v_vencimento := COALESCE(
    NEW.data_entrega,
    NEW.data_previsao_fechamento,
    (CURRENT_DATE + INTERVAL '30 days')::date
  );
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
    data_entrega, data_previsao_fechamento, lead_id, servico_catalogo_id, tenant_id
  ON public.hub_negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_sync_conta_receber_de_negocio();

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
GRANT EXECUTE ON FUNCTION public.hub_upsert_servicos_catalogo_batch(UUID, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ─── 3) Views financeiras ───────────────────────────────────────────────────

DROP VIEW IF EXISTS public.vw_rel_contas_receber;
CREATE VIEW public.vw_rel_contas_receber
WITH (security_invoker = true)
AS SELECT tenant_id, id, descricao, valor, vencimento, status, criado_em
FROM public.hub_contas_receber;

DROP VIEW IF EXISTS public.vw_rel_contas_pagar;
CREATE VIEW public.vw_rel_contas_pagar
WITH (security_invoker = true)
AS SELECT tenant_id, id, descricao, valor, vencimento, status, criado_em
FROM public.hub_contas_pagar;

DROP VIEW IF EXISTS public.vw_rel_fluxo_caixa;
CREATE VIEW public.vw_rel_fluxo_caixa
WITH (security_invoker = true)
AS
SELECT tenant_id, 'receber'::text AS tipo, id, descricao, valor, vencimento, status, criado_em
FROM public.hub_contas_receber
UNION ALL
SELECT tenant_id, 'pagar'::text AS tipo, id, descricao, valor, vencimento, status, criado_em
FROM public.hub_contas_pagar;

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

GRANT SELECT ON public.vw_rel_contas_receber TO authenticated, service_role, anon;
GRANT SELECT ON public.vw_rel_contas_pagar TO authenticated, service_role, anon;
GRANT SELECT ON public.vw_rel_fluxo_caixa TO authenticated, service_role, anon;
GRANT SELECT ON public.vw_rel_servicos_catalogo TO authenticated, service_role, anon;

-- Fim — se o catálogo já existir mas a RPC falhar, use docs/sql/hub-upsert-servicos-catalogo-rpc.sql
-- Depois: Settings → API → Reload schema (ou aguarde o NOTIFY acima).
