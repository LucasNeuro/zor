-- Memórias persistentes por agente (interno + externo): aprendizados operacionais, preferências de equipa, padrões recorrentes.

CREATE TABLE IF NOT EXISTS public.hub_memorias_agente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL REFERENCES public.hub_tenants (id) ON DELETE SET NULL,
  agente_slug TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  confianca NUMERIC(3, 2) NOT NULL DEFAULT 0.70 CHECK (confianca >= 0 AND confianca <= 1),
  origem TEXT NOT NULL DEFAULT 'ia_engine' CHECK (origem IN ('ia_engine', 'briefing', 'whatsapp', 'manual')),
  criado_por TEXT NOT NULL DEFAULT 'ia',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_memorias_agente_slug_confianca_idx
  ON public.hub_memorias_agente (agente_slug, confianca DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS hub_memorias_agente_tenant_slug_idx
  ON public.hub_memorias_agente (tenant_id, agente_slug);

CREATE OR REPLACE FUNCTION public.hub_memorias_agente_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_memorias_agente_set_updated_at ON public.hub_memorias_agente;
CREATE TRIGGER trg_hub_memorias_agente_set_updated_at
BEFORE UPDATE ON public.hub_memorias_agente
FOR EACH ROW
EXECUTE FUNCTION public.hub_memorias_agente_set_updated_at();

COMMENT ON TABLE public.hub_memorias_agente IS
  'Memórias persistentes do agente (não do lead): contexto operacional reutilizado em WhatsApp, briefing interno e simulação.';
