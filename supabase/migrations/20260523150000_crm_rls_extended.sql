-- RLS estendido: negócios, empresas, pessoas (Fase E multi-tenant)

CREATE OR REPLACE FUNCTION public.app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(COALESCE(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')),
    ''
  )::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.app_tenant_id() TO anon, authenticated;

ALTER TABLE public.hub_negocios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_negocios_anon ON public.hub_negocios;
CREATE POLICY hub_negocios_anon ON public.hub_negocios
  FOR ALL TO anon
  USING (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = default_obra10_tenant_id());

ALTER TABLE public.hub_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_empresas_anon ON public.hub_empresas;
CREATE POLICY hub_empresas_anon ON public.hub_empresas
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.hub_pessoas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_pessoas_anon ON public.hub_pessoas;
CREATE POLICY hub_pessoas_anon ON public.hub_pessoas
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.hub_obras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obras_auth ON public.hub_obras;
CREATE POLICY hub_obras_auth ON public.hub_obras
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND (tenant_id IS NULL OR tenant_id = app_tenant_id()))
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());
