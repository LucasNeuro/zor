-- =============================================================================
-- ZOR — tenant inicial + função default (prod)
-- UUID fixo para colocar em DEFAULT_TENANT_ID e NEXT_PUBLIC_TENANT_ID no Render/.env
-- =============================================================================

INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid,
  'zor',
  'Zor',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  nome_exibicao = EXCLUDED.nome_exibicao,
  ativo = EXCLUDED.ativo;

-- Opcional: manter também tenant legado usado por migrações antigas (RLS anon)
INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+ (legado RLS)',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Apontar default_obra10_tenant_id para Zor (opcional — descomente se quiser RLS anon no tenant Zor)
-- CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
-- RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
--   SELECT 'a1b2c3d4-e5f6-4789-a012-3456789abcde'::uuid;
-- $$;

COMMENT ON TABLE public.hub_tenants IS 'Multi-tenant: use slug=zor, id=a1b2c3d4-e5f6-4789-a012-3456789abcde no .env';
