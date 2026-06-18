-- Bucket público para PDFs de boletos (console Owner / ops).
-- Idempotente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waje-ops-boletos',
  'waje-ops-boletos',
  true,
  5242880,
  ARRAY['application/pdf', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "waje_ops_boletos_select_public" ON storage.objects;
CREATE POLICY "waje_ops_boletos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'waje-ops-boletos');
