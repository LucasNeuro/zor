-- =============================================================================
-- RPC hub_upsert_servicos_catalogo_batch (somente a função de sync)
-- Use quando hub_tenant_servicos_catalogo já existir mas a RPC estiver ausente
-- ou o PostgREST não enxergar a função (schema cache desatualizado).
--
-- Depois de executar: Supabase Dashboard → Settings → API → Reload schema
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hub_upsert_servicos_catalogo_batch(
  p_tenant_id UUID,
  p_itens JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_slug TEXT;
  v_nome TEXT;
  v_desc TEXT;
  v_preco NUMERIC(12, 2);
  v_inseridos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_slugs TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'p_itens deve ser um array JSON';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_nome := btrim(COALESCE(v_item ->> 'nome', ''));
    IF v_nome = '' THEN
      CONTINUE;
    END IF;
    v_slug := lower(regexp_replace(v_nome, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-|-$)', '', 'g');
    IF v_slug = '' THEN
      v_slug := 'item-' || substr(md5(v_nome), 1, 8);
    END IF;
    v_desc := NULLIF(btrim(COALESCE(v_item ->> 'descricao', '')), '');
    v_preco := NULL;
    IF (v_item ->> 'preco_referencia') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_preco := (v_item ->> 'preco_referencia')::numeric;
    END IF;
    v_slugs := array_append(v_slugs, v_slug);

    INSERT INTO public.hub_tenant_servicos_catalogo (
      tenant_id, slug, nome, descricao, preco_referencia, origem, ativo, ordem, metadata
    )
    VALUES (
      p_tenant_id,
      v_slug,
      v_nome,
      v_desc,
      v_preco,
      COALESCE(NULLIF(v_item ->> 'origem', ''), 'conhecimento_ia'),
      true,
      COALESCE((v_item ->> 'ordem')::integer, 0),
      COALESCE(v_item -> 'metadata', '{}'::jsonb)
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = COALESCE(EXCLUDED.descricao, public.hub_tenant_servicos_catalogo.descricao),
      preco_referencia = COALESCE(EXCLUDED.preco_referencia, public.hub_tenant_servicos_catalogo.preco_referencia),
      origem = EXCLUDED.origem,
      ativo = true,
      ordem = EXCLUDED.ordem,
      atualizado_em = NOW();

    IF xmax = 0 THEN
      v_inseridos := v_inseridos + 1;
    ELSE
      v_atualizados := v_atualizados + 1;
    END IF;
  END LOOP;

  INSERT INTO public.hub_tenant_servicos_catalogo_sync (
    tenant_id, itens_inseridos, itens_atualizados, metadata
  )
  VALUES (
    p_tenant_id,
    v_inseridos,
    v_atualizados,
    jsonb_build_object('slugs', v_slugs)
  );

  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'total', v_inseridos + v_atualizados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hub_upsert_servicos_catalogo_batch(UUID, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
