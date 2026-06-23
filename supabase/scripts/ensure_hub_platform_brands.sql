-- SQL Editor manual — espelha 20260624120000_hub_platform_brands.sql

CREATE TABLE IF NOT EXISTS public.hub_platform_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nome text NOT NULL,
  tagline text,
  dominios text[] NOT NULL DEFAULT '{}',
  logo_url text,
  logo_dark_url text,
  favicon_url text,
  cor_primaria text NOT NULL DEFAULT '#3f9848',
  cor_accent text NOT NULL DEFAULT '#92ff00',
  cor_fundo text NOT NULL DEFAULT '#0b1f10',
  company_name text,
  is_principal boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_platform_brands_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_hub_platform_brands_ativo ON public.hub_platform_brands (ativo);

ALTER TABLE public.hub_tenants
  ADD COLUMN IF NOT EXISTS platform_brand_id uuid REFERENCES public.hub_platform_brands (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hub_tenants_platform_brand ON public.hub_tenants (platform_brand_id);

INSERT INTO public.hub_platform_brands (slug, nome, tagline, dominios, logo_url, favicon_url, cor_primaria, cor_accent, cor_fundo, company_name, is_principal, ativo)
VALUES
  ('waje', 'Waje', 'IA para atendimento e CRM', ARRAY['waje.com.br', 'www.waje.com.br', 'localhost:3001', 'localhost:3000', '127.0.0.1:3001'], NULL, '/favicons/favicon-192x192.png', '#3f9848', '#92ff00', '#0b1f10', 'Onze Tecnologia', true, true),
  ('synkron', 'Synkron.IA', 'Inteligência sincronizada', ARRAY['synkronia.com.br', 'www.synkronia.com.br'], NULL, NULL, '#3f9848', '#4fc3f7', '#000000', 'Synkron.IA', false, true)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.hub_platform_brands
  ADD COLUMN IF NOT EXISTS registration_type text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS billing_legal_name text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Bucket Storage para upload de logos (corra também ensure_platform_brands_bucket.sql se o upload falhar)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-brands',
  'platform-brands',
  true,
  4194304,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "platform_brands_select_public" ON storage.objects;
CREATE POLICY "platform_brands_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-brands');
