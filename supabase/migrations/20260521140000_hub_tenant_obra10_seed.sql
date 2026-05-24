-- Tenant padrão Obra10 (usado por DEFAULT_TENANT_ID / cadastro CRM).
INSERT INTO public.hub_tenants (id, slug, nome_exibicao, ativo)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'obra10',
  'Obra10+',
  true
)
ON CONFLICT (id) DO NOTHING;
