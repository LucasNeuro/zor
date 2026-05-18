-- RAG por agente: documentos no Storage + chunks com embeddings Mistral em pgvector.
-- Aplicar antes de usar a UI de upload no wizard.

CREATE EXTENSION IF NOT EXISTS vector;

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
    'application/json',
    'application/pdf',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.hub_agente_rag_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.hub_tenants(id),
  agente_slug TEXT NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'hub-agent-rag-docs',
  object_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexando',
  chunks_count INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexado_em TIMESTAMPTZ,
  UNIQUE (bucket_id, object_path),
  CONSTRAINT hub_agente_rag_documentos_status_chk
    CHECK (status IN ('indexando', 'pronto', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_documentos_agente
  ON public.hub_agente_rag_documentos (agente_slug, status, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.hub_agente_rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.hub_agente_rag_documentos(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  agente_slug TEXT NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  conteudo TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_chunks_agente
  ON public.hub_agente_rag_chunks (agente_slug, document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_hub_agente_rag_chunks_embedding_hnsw
  ON public.hub_agente_rag_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_hub_agente_rag_chunks(
  p_agente_slug TEXT,
  p_query_embedding vector(1024),
  p_match_count INTEGER DEFAULT 5,
  p_similarity_threshold DOUBLE PRECISION DEFAULT 0.68
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  agente_slug TEXT,
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
    c.agente_slug,
    d.nome_arquivo,
    c.conteudo,
    1 - (c.embedding <=> p_query_embedding) AS similarity,
    c.chunk_index
  FROM public.hub_agente_rag_chunks c
  JOIN public.hub_agente_rag_documentos d ON d.id = c.document_id
  WHERE c.agente_slug = p_agente_slug
    AND d.status = 'pronto'
    AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(COALESCE(p_match_count, 5), 12));
$$;

COMMENT ON TABLE public.hub_agente_rag_documentos IS 'Documentos anexados ao agente para RAG; ficheiro fonte fica no bucket hub-agent-rag-docs.';
COMMENT ON TABLE public.hub_agente_rag_chunks IS 'Chunks textualizados com embedding mistral-embed (1024 dimensões).';
COMMENT ON FUNCTION public.match_hub_agente_rag_chunks IS 'Busca semântica por agente usando cosine distance em pgvector.';

ALTER TABLE public.hub_agente_rag_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_agente_rag_chunks ENABLE ROW LEVEL SECURITY;

-- A aplicação usa SUPABASE_SERVICE_ROLE_KEY nas rotas server-side. Políticas de utilizador
-- podem ser adicionadas quando a autenticação/tenant no painel estiver consolidada.
