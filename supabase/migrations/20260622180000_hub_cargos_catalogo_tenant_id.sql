-- Cargos isolados por tenant (re-executável no SQL Editor).
-- Produção já tem: id (PK), tenant_id, slug UNIQUE global — só trocamos a unicidade do slug.

-- 1) tenant_id (ambientes antigos)
ALTER TABLE public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_cargos_catalogo_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.hub_cargos_catalogo
      ADD CONSTRAINT hub_cargos_catalogo_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.hub_tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hub_cargos_catalogo_tenant_id
  ON public.hub_cargos_catalogo (tenant_id);

COMMENT ON COLUMN public.hub_cargos_catalogo.tenant_id IS
  'Dono do cargo. NULL = legado/plataforma (oculto na listagem por tenant).';

-- 2) id (só se a tabela ainda usar slug como PK)
ALTER TABLE public.hub_cargos_catalogo
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.hub_cargos_catalogo
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.hub_cargos_catalogo
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'hub_cargos_catalogo'
      AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) LIKE '%slug%'
  ) THEN
    ALTER TABLE public.hub_cargos_catalogo DROP CONSTRAINT hub_cargos_catalogo_pkey;
    ALTER TABLE public.hub_cargos_catalogo ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.hub_cargos_catalogo
      ADD CONSTRAINT hub_cargos_catalogo_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 3) Remover unicidade GLOBAL em slug (bloqueia o mesmo slug em tenants diferentes)
ALTER TABLE public.hub_cargos_catalogo
  DROP CONSTRAINT IF EXISTS hub_cargos_catalogo_slug_key;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'hub_cargos_catalogo'
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS colnum(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = colnum.attnum
        WHERE a.attname = 'slug'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.hub_cargos_catalogo DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.hub_cargos_catalogo_slug_key;

-- 4) Unicidade por tenant + legado
CREATE UNIQUE INDEX IF NOT EXISTS hub_cargos_catalogo_tenant_slug_uidx
  ON public.hub_cargos_catalogo (tenant_id, slug)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hub_cargos_catalogo_slug_legacy_uidx
  ON public.hub_cargos_catalogo (slug)
  WHERE tenant_id IS NULL;

NOTIFY pgrst, 'reload schema';
