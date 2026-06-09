-- tenant_id em hub_ciclos_ia (wizard provisiona ciclo ao criar agente).
ALTER TABLE public.hub_ciclos_ia
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_ciclos_ia c
SET tenant_id = i.tenant_id
FROM public.hub_agente_identidade i
WHERE c.tenant_id IS NULL
  AND c.agente_slug = i.agente_slug
  AND i.tenant_id IS NOT NULL;

UPDATE public.hub_ciclos_ia
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_ciclos_ia_tenant
  ON public.hub_ciclos_ia (tenant_id, agente_slug);
