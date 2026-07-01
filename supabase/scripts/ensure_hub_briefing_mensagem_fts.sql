-- FTS para harness_session_search — colar no Supabase SQL Editor → Run
-- Equivalente: supabase/migrations/20260803100000_hub_briefing_mensagem_fts.sql

ALTER TABLE public.hub_crm_agente_briefing_mensagem
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_hub_briefing_mensagem_fts
  ON public.hub_crm_agente_briefing_mensagem
  USING gin (search_vector);

CREATE OR REPLACE FUNCTION public.hub_briefing_mensagem_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.conteudo, '')), 'A');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_briefing_mensagem_fts ON public.hub_crm_agente_briefing_mensagem;
CREATE TRIGGER trg_hub_briefing_mensagem_fts
  BEFORE INSERT OR UPDATE OF conteudo ON public.hub_crm_agente_briefing_mensagem
  FOR EACH ROW EXECUTE FUNCTION public.hub_briefing_mensagem_search_vector_update();

UPDATE public.hub_crm_agente_briefing_mensagem
SET search_vector = setweight(to_tsvector('portuguese', coalesce(conteudo, '')), 'A')
WHERE search_vector IS NULL;

CREATE OR REPLACE FUNCTION public.hub_briefing_mensagem_search(
  p_agente_slug text,
  p_query text,
  p_limite integer DEFAULT 8
)
RETURNS TABLE (
  sessao_id uuid,
  papel text,
  conteudo text,
  trecho text,
  criado_em timestamptz,
  rank real
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.sessao_id,
    m.papel,
    m.conteudo,
    left(m.conteudo, 400) AS trecho,
    m.criado_em,
    ts_rank(m.search_vector, websearch_to_tsquery('portuguese', p_query)) AS rank
  FROM public.hub_crm_agente_briefing_mensagem m
  INNER JOIN public.hub_crm_agente_briefing_sessao s ON s.id = m.sessao_id
  WHERE s.agente_slug = p_agente_slug
    AND m.search_vector @@ websearch_to_tsquery('portuguese', p_query)
  ORDER BY rank DESC, m.criado_em DESC
  LIMIT greatest(1, least(p_limite, 24));
$$;
