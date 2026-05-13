-- Corrige: "Could not find the 'tenant_id' column of 'hub_fila_mensagens' in the schema cache"
-- quando o projeto Supabase não executou ainda 20260509120000_hub_ciclos_slugs_e_tenants.sql.
-- Idempotente: seguro correr várias vezes.

CREATE TABLE IF NOT EXISTS public.hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.hub_fila_mensagens
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id);

UPDATE public.hub_fila_mensagens
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

-- Após correr: no Dashboard Supabase → Project Settings → API → "Reload schema" se o erro de cache persistir.
