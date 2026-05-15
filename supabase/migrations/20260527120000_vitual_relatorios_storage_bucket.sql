-- Relatórios Markdown do agente Vitual (agents/run.py) → Supabase Storage.
-- Upload via API: POST .../storage/v1/object/vitual-relatorios/...
-- Recomendação: usar SUPABASE_SERVICE_ROLE_KEY no agente (contorna RLS de storage).
-- Opcional: defina o bucket como public no dashboard se quiseres URLs públicas sem token.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vitual-relatorios',
  'vitual-relatorios',
  false,
  10485760,
  ARRAY[
    'text/markdown',
    'text/markdown; charset=utf-8',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
