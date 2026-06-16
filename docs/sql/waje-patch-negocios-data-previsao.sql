-- =============================================================================
-- PATCH: corrige erro "column data_previsao_fechamento of relation hub_negocios does not exist"
-- Rode no Supabase SQL Editor se waje-bootstrap-prioridade.sql falhou no trigger.
-- Depois: Settings → API → Reload schema
-- =============================================================================

-- Colunas do trigger hub_negocios_sync_conta_receber
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aberto';
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC(12, 2);
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_previsao_fechamento DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID;

-- Contas a receber (se ainda não existirem)
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

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL;

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS servico_catalogo_id UUID;

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

-- Views financeiras
DROP VIEW IF EXISTS public.vw_rel_contas_receber;
CREATE VIEW public.vw_rel_contas_receber
WITH (security_invoker = true)
AS SELECT tenant_id, id, descricao, valor, vencimento, status, criado_em
FROM public.hub_contas_receber;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_contas_pagar') THEN
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
  ELSE
    EXECUTE $v$
      DROP VIEW IF EXISTS public.vw_rel_fluxo_caixa;
      CREATE VIEW public.vw_rel_fluxo_caixa
      WITH (security_invoker = true)
      AS
      SELECT tenant_id, 'receber'::text AS tipo, id, descricao, valor, vencimento, status, criado_em
      FROM public.hub_contas_receber;
    $v$;
  END IF;
END $$;

GRANT SELECT ON public.vw_rel_contas_receber TO authenticated, service_role, anon;
GRANT SELECT ON public.vw_rel_fluxo_caixa TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
