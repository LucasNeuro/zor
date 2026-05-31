-- Agentes «só playbook» (area = playbook, sem linha em hub_cargos_catalogo).

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS instrucao_modo TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.instrucao_modo IS
  'playbook_only | cargo_catalogo — origem das instruções estáticas do agente.';

UPDATE public.hub_agente_identidade
SET instrucao_modo = 'playbook_only'
WHERE instrucao_modo IS NULL
  AND COALESCE(area, '') = 'playbook'
  AND (cargo IS NULL OR btrim(cargo) = '');

-- Remove triggers antigos de validação de cargo (nomes variam por ambiente).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'hub_agente_identidade'
      AND NOT t.tgisinternal
      AND (
        t.tgname ILIKE '%cargo%'
        OR t.tgname ILIKE '%validar%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.hub_agente_identidade', r.tgname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.hub_agente_identidade_validar_cargo_catalogo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cargo text;
BEGIN
  -- Playbook-only: não validar catálogo (cargo é rótulo fixo, não hub_cargos_catalogo).
  IF COALESCE(NEW.instrucao_modo, '') IN ('playbook_only', 'playbook-only')
     OR COALESCE(NEW.area, '') = 'playbook' THEN
    RETURN NEW;
  END IF;

  v_cargo := NULLIF(btrim(COALESCE(NEW.cargo, '')), '');

  IF v_cargo IS NULL THEN
    RAISE EXCEPTION
      'Cargo % nao existe no catalogo ativo. Use apenas cargos ativos de hub_cargos_catalogo.',
      '<NULL>';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.hub_cargos_catalogo c
    WHERE c.ativo IS TRUE
      AND c.titulo = v_cargo
  ) THEN
    RAISE EXCEPTION
      'Cargo % nao existe no catalogo ativo. Use apenas cargos ativos de hub_cargos_catalogo.',
      v_cargo;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.hub_agente_identidade_validar_cargo_catalogo() IS
  'Valida hub_agente_identidade.cargo contra hub_cargos_catalogo; ignora agentes playbook-only (area/instrucao_modo).';

DROP TRIGGER IF EXISTS trg_hub_agente_identidade_validar_cargo ON public.hub_agente_identidade;
DROP TRIGGER IF EXISTS trg_hub_agente_validar_cargo ON public.hub_agente_identidade;
DROP TRIGGER IF EXISTS hub_agente_identidade_validar_cargo ON public.hub_agente_identidade;

CREATE TRIGGER trg_hub_agente_identidade_validar_cargo
  BEFORE INSERT OR UPDATE OF cargo, area, instrucao_modo
  ON public.hub_agente_identidade
  FOR EACH ROW
  EXECUTE FUNCTION public.hub_agente_identidade_validar_cargo_catalogo();
