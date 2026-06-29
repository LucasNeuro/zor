-- Linha WhatsApp do empresário (gestor) — um número por tenant para falar com agentes internos.

CREATE TABLE IF NOT EXISTS public.hub_linha_gestor_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  uazapi_instance_id text,
  uazapi_instance_token text,
  uazapi_instance_name text,
  uazapi_connection_status text,
  uazapi_proxy_country text,
  uazapi_proxy_state text,
  uazapi_proxy_city text,
  uazapi_snapshot_at timestamptz,
  telefones_autorizados jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_linha_gestor_whatsapp_tenant_uidx
  ON public.hub_linha_gestor_whatsapp (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS hub_linha_gestor_whatsapp_instance_id_uidx
  ON public.hub_linha_gestor_whatsapp (uazapi_instance_id)
  WHERE uazapi_instance_id IS NOT NULL AND trim(uazapi_instance_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS hub_linha_gestor_whatsapp_instance_token_uidx
  ON public.hub_linha_gestor_whatsapp (uazapi_instance_token)
  WHERE uazapi_instance_token IS NOT NULL AND trim(uazapi_instance_token) <> '';

CREATE TABLE IF NOT EXISTS public.hub_gestor_whatsapp_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  telefone_gestor text NOT NULL,
  agente_ativo_slug text,
  push_name text,
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_gestor_whatsapp_sessao_tenant_tel_uidx
  ON public.hub_gestor_whatsapp_sessao (tenant_id, telefone_gestor);

CREATE TABLE IF NOT EXISTS public.hub_gestor_whatsapp_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.hub_gestor_whatsapp_sessao(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo text NOT NULL,
  metadata jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_gestor_whatsapp_mensagem_sessao_idx
  ON public.hub_gestor_whatsapp_mensagem (sessao_id, criado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_linha_gestor_whatsapp TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_gestor_whatsapp_sessao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_gestor_whatsapp_mensagem TO service_role;
