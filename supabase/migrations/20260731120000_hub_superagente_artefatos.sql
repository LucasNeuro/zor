-- Artefactos canvas gerados por superagentes internos (relatórios HTML partilháveis).

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

CREATE INDEX IF NOT EXISTS idx_hub_superagente_artefatos_tenant
  ON public.hub_superagente_artefatos (tenant_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_hub_superagente_artefatos_agente
  ON public.hub_superagente_artefatos (agente_slug, criado_em DESC);

COMMENT ON TABLE public.hub_superagente_artefatos IS
  'Relatórios HTML (canvas) gerados por agentes internos — links públicos para WhatsApp gestor.';
