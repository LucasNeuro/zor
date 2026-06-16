-- Campos Waje: data_entrada + data_entrega no negócio (formulário genérico)
-- Execute no Supabase SQL Editor → Reload schema

ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.hub_negocios ADD COLUMN IF NOT EXISTS data_entrega DATE;

COMMENT ON COLUMN public.hub_negocios.data_entrada IS 'Data de início/entrada do negócio (Waje).';
COMMENT ON COLUMN public.hub_negocios.data_entrega IS 'Data prevista de entrega/recebimento (Waje).';

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

NOTIFY pgrst, 'reload schema';
