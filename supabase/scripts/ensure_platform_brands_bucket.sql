-- SQL Editor manual — bucket de logos white-label (espelha 20260624140000_platform_brands_bucket.sql)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-brands',
  'platform-brands',
  true,
  4194304,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'application/octet-stream'
  ]::text[]
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
