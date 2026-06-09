-- Buckets Storage para agentes Waje (playbook público + RAG privado).
-- Idempotente — igual ao Obra10: hub-agent-playbooks + hub-agent-rag-docs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-agent-playbooks',
  'hub-agent-playbooks',
  true,
  5242880,
  ARRAY[
    'text/markdown',
    'text/markdown; charset=utf-8',
    'text/plain',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "hub_agent_playbooks_select_public" ON storage.objects;
CREATE POLICY "hub_agent_playbooks_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hub-agent-playbooks');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-agent-rag-docs',
  'hub-agent-rag-docs',
  false,
  5242880,
  ARRAY[
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/rtf',
    'text/xml',
    'application/json',
    'application/xml',
    'application/pdf',
    'application/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
