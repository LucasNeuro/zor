-- Auditoria de ações administrativas (equipe, cargos, acessos) por tenant.

CREATE TABLE IF NOT EXISTS public.hub_auditoria_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_auth_id uuid,
  actor_nome text,
  actor_email text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  resumo text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_auditoria_sistema_tenant_em
  ON public.hub_auditoria_sistema (tenant_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_hub_auditoria_sistema_entidade
  ON public.hub_auditoria_sistema (entidade, criado_em DESC);
