-- Tabelas financeiras mínimas para /crm/relatorios (quando 20260523120000 não foi aplicada).

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
