-- CRM Obra10+ integral — núcleo comercial, imóveis, KPIs, obras, projetos, financeiro (idempotente).

-- ─── Função timestamp (reutilizada) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- ─── Notas, serviços, propostas, memórias ───────────────────────────────────
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

-- ─── Atividades generalizadas ───────────────────────────────────────────────
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

-- FK negócio (após hub_negocios existir)
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

-- ─── Imóveis ──────────────────────────────────────────────────────────────────
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

-- ─── Aprovações ───────────────────────────────────────────────────────────────
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

-- ─── KPIs ─────────────────────────────────────────────────────────────────────
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
  ('taxa_qualificacao', 'Taxa de qualificação', '% leads qualificados / total', '%'),
  ('taxa_conversao_negocio', 'Conversão lead→negócio', '% leads com negócio', '%'),
  ('pipeline_aberto', 'Pipeline aberto', 'Soma valor estimado negócios abertos', 'BRL'),
  ('leads_hoje', 'Leads hoje', 'Leads criados no dia', 'un'),
  ('aprovacoes_pendentes', 'Aprovações pendentes', 'Decisões aguardando', 'un')
ON CONFLICT (slug) DO NOTHING;

-- ─── Obras ────────────────────────────────────────────────────────────────────
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

-- ─── Projetos ─────────────────────────────────────────────────────────────────
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

-- ─── Financeiro (mínimo) ──────────────────────────────────────────────────────
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

-- Helpers RLS (se migração 20260510130000 ainda não aplicada no remoto)
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

COMMENT ON TABLE public.hub_imoveis IS 'Catálogo de imóveis (Produtos → Imóveis).';
COMMENT ON TABLE public.hub_obras IS 'Execução de obra vinculada a negócio/imóvel.';
