-- Cargos e permissões por empresa (tenant) para gestão de acessos no CRM.

CREATE TABLE IF NOT EXISTS public.hub_acesso_cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  nome text NOT NULL,
  descricao text,
  permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_acesso_cargos_slug_tenant_unique UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_acesso_cargos_tenant
  ON public.hub_acesso_cargos (tenant_id, ativo);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.hub_tenants(id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS access_role_id uuid REFERENCES public.hub_acesso_cargos(id);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_access_role_id ON public.users (access_role_id);

-- Backfill seguro para bases legadas:
-- usa DEFAULT_TENANT_ID quando existir; caso contrário mantém null.
DO $$
DECLARE
  v_default_tenant uuid;
BEGIN
  BEGIN
    v_default_tenant := NULLIF(current_setting('app.settings.default_tenant_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_default_tenant := NULL;
  END;

  IF v_default_tenant IS NULL THEN
    BEGIN
      v_default_tenant := NULLIF(current_setting('DEFAULT_TENANT_ID', true), '')::uuid;
    EXCEPTION WHEN others THEN
      v_default_tenant := NULL;
    END;
  END IF;

  IF v_default_tenant IS NULL THEN
    SELECT id INTO v_default_tenant
    FROM public.hub_tenants
    ORDER BY criado_em ASC
    LIMIT 1;
  END IF;

  IF v_default_tenant IS NOT NULL THEN
    UPDATE public.users
    SET tenant_id = v_default_tenant
    WHERE tenant_id IS NULL;
  END IF;
END $$;
