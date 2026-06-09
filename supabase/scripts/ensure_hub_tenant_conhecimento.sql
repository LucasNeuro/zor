-- Script manual (SQL Editor) — espelha 20260621190000_hub_tenant_conhecimento.sql

CREATE EXTENSION IF NOT EXISTS vector;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hub-tenant-conhecimento',
  'hub-tenant-conhecimento',
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

CREATE TABLE IF NOT EXISTS public.hub_tenant_conhecimento_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'hub-tenant-conhecimento',
  object_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  titulo TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexando',
  chunks_count INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  texto_extraido TEXT,
  resumo_ia JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexado_em TIMESTAMPTZ,
  UNIQUE (bucket_id, object_path),
  CONSTRAINT hub_tenant_conhecimento_documento_status_chk
    CHECK (status IN ('indexando', 'pronto', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_conhecimento_documento_tenant
  ON public.hub_tenant_conhecimento_documento (tenant_id, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.hub_tenant_conhecimento_chunk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.hub_tenant_conhecimento_documento(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_conhecimento_chunk_tenant
  ON public.hub_tenant_conhecimento_chunk (tenant_id, document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_hub_tenant_conhecimento_chunk_embedding_hnsw
  ON public.hub_tenant_conhecimento_chunk
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_hub_tenant_conhecimento_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1024),
  p_match_count INTEGER DEFAULT 5,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.68
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  tenant_id UUID,
  titulo TEXT,
  nome_arquivo TEXT,
  conteudo TEXT,
  similarity DOUBLE PRECISION,
  chunk_index INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.tenant_id,
    COALESCE(NULLIF(TRIM(d.titulo), ''), d.nome_arquivo) AS titulo,
    d.nome_arquivo,
    c.conteudo,
    1 - (c.embedding <=> p_query_embedding) AS similarity,
    c.chunk_index
  FROM public.hub_tenant_conhecimento_chunk c
  JOIN public.hub_tenant_conhecimento_documento d ON d.id = c.document_id
  WHERE c.tenant_id = p_tenant_id
    AND d.status = 'pronto'
    AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(p_match_count, 5), 12));
$$;

ALTER TABLE public.hub_tenant_conhecimento_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_tenant_conhecimento_chunk ENABLE ROW LEVEL SECURITY;
