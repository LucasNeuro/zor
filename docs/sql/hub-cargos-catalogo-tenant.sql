-- =============================================================================
-- WAJE — Cargos por tenant (cole no Supabase SQL Editor)
-- =============================================================================
-- Corrige: cliente A vê cargo criado pelo cliente B.
-- Após rodar: Settings → API → Reload schema (ou rode NOTIFY no final).
-- =============================================================================

-- --- DIAGNÓSTICO (rode primeiro se quiser ver o estado atual) ---
SELECT
  c.conname AS constraint_name,
  c.contype AS type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'hub_cargos_catalogo'
ORDER BY c.contype, c.conname;

SELECT slug, tenant_id, titulo, nome
FROM public.hub_cargos_catalogo
ORDER BY tenant_id NULLS FIRST, slug;

-- Duplicatas que impedem os índices (deve retornar 0 linhas):
SELECT tenant_id, slug, count(*) AS n
FROM public.hub_cargos_catalogo
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, slug
HAVING count(*) > 1;

SELECT slug, count(*) AS n
FROM public.hub_cargos_catalogo
WHERE tenant_id IS NULL
GROUP BY slug
HAVING count(*) > 1;

-- --- MIGRAÇÃO (mesmo conteúdo de supabase/migrations/20260622180000_...) ---
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

CREATE UNIQUE INDEX IF NOT EXISTS hub_cargos_catalogo_tenant_slug_uidx
  ON public.hub_cargos_catalogo (tenant_id, slug)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hub_cargos_catalogo_slug_legacy_uidx
  ON public.hub_cargos_catalogo (slug)
  WHERE tenant_id IS NULL;

NOTIFY pgrst, 'reload schema';

-- --- CONFERÊNCIA ---
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'hub_cargos_catalogo'
ORDER BY indexname;
