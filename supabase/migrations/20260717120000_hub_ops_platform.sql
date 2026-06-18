-- Console operacional Waje: coluna owner + mensalidades por tenant.
-- Idempotente — seguro em produção.

-- ─── 1) Coluna owner (equipe Waje → /ops) ───────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS owner BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.owner IS
  'Equipe Waje com acesso ao console operacional (/ops). Não confundir com dono do tenant CRM.';

CREATE INDEX IF NOT EXISTS idx_users_owner_ops
  ON public.users (owner)
  WHERE owner = true;

-- ─── 2) Mensalidades SaaS por tenant ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_tenant_mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  competencia DATE NOT NULL,
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK (valor_centavos >= 0),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  vencimento DATE,
  pago_em TIMESTAMPTZ,
  notas TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hub_tenant_mensalidades_competencia_unique UNIQUE (tenant_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_mensalidades_tenant_comp
  ON public.hub_tenant_mensalidades (tenant_id, competencia DESC);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_mensalidades_status
  ON public.hub_tenant_mensalidades (status, vencimento);

COMMENT ON TABLE public.hub_tenant_mensalidades IS
  'Mensalidades da plataforma Waje cobradas de cada tenant (console /ops).';

ALTER TABLE public.hub_tenant_mensalidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_tenant_mensalidades_service ON public.hub_tenant_mensalidades;
CREATE POLICY hub_tenant_mensalidades_service ON public.hub_tenant_mensalidades
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS hub_tenant_mensalidades_ts ON public.hub_tenant_mensalidades;
CREATE TRIGGER hub_tenant_mensalidades_ts
  BEFORE UPDATE ON public.hub_tenant_mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_tenant_mensalidades TO service_role;

-- ─── 3) Exemplo: promover utilizador Waje (ajuste e-mail/auth_id) ───────────
-- UPDATE public.users SET owner = true WHERE lower(trim(email)) = 'ops@waje.com.br';
