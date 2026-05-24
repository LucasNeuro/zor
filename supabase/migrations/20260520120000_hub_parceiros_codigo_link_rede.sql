-- Código único por parceiro + link público reutilizável da rede
ALTER TABLE public.hub_parceiros
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS hub_parceiros_codigo_unique
  ON public.hub_parceiros (codigo)
  WHERE codigo IS NOT NULL;

-- Link único permanente (vários cadastros pelo mesmo URL)
INSERT INTO public.hub_links_cadastro (token, tipo, criado_por, expira_em, metadata)
SELECT
  'rede',
  'parceiro',
  'sistema',
  '2099-12-31T23:59:59+00'::timestamptz,
  '{"reutilizavel":true,"tipo_link":"rede_publica"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_links_cadastro WHERE token = 'rede'
);
