-- Cole no SQL Editor do Supabase (idempotente — pode executar mais de uma vez).
-- Artefactos: HTML na tabela (servido em GET /artefato/{id}). NÃO usa hub-documentos.

CREATE TABLE IF NOT EXISTS public.hub_superagente_artefatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agente_slug text NOT NULL,
  titulo text NOT NULL,
  url_publica text NOT NULL,
  arquivo_id text,
  telefone_gestor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_superagente_artefatos
  ADD COLUMN IF NOT EXISTS conteudo_html text;

CREATE INDEX IF NOT EXISTS idx_hub_superagente_artefatos_tenant
  ON public.hub_superagente_artefatos (tenant_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_hub_superagente_artefatos_agente
  ON public.hub_superagente_artefatos (agente_slug, criado_em DESC);

COMMENT ON TABLE public.hub_superagente_artefatos IS
  'Relatórios HTML (canvas) de superagentes internos. Conteúdo em conteudo_html; URL pública /artefato/{id}.';

COMMENT ON COLUMN public.hub_superagente_artefatos.conteudo_html IS
  'HTML completo (Chart.js). Fonte principal — não misturar com hub-documentos da empresa.';

-- Bucket separado só para cópias/exportações de artefactos IA (opcional; o app serve pela tabela).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-superagente-artefatos',
  'hub-superagente-artefatos',
  true,
  10485760,
  ARRAY[
    'text/html',
    'text/html; charset=utf-8',
    'application/pdf',
    'text/plain',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "hub_superagente_artefatos_select_public" ON storage.objects;
CREATE POLICY "hub_superagente_artefatos_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hub-superagente-artefatos');
