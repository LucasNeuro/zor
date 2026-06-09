-- Playbook: metadados no agente + bucket (Waje / hub-agent-playbooks)
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS playbook_object_path TEXT,
  ADD COLUMN IF NOT EXISTS playbook_public_url TEXT,
  ADD COLUMN IF NOT EXISTS playbook_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS playbook_source_hash TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.playbook_object_path IS 'Caminho no bucket hub-agent-playbooks (ex.: {tenant}/{slug}/playbook.md).';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_public_url IS 'URL pública do Markdown (Supabase getPublicUrl).';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_generated_at IS 'Última geração/publicação do playbook.';
COMMENT ON COLUMN public.hub_agente_identidade.playbook_source_hash IS 'SHA-256 do snapshot usado na última geração.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-agent-playbooks',
  'hub-agent-playbooks',
  true,
  5242880,
  ARRAY['text/markdown', 'text/plain', 'application/octet-stream']::text[]
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
