-- =============================================================================
-- ZOR — executar PRIMEIRO (antes do resto do schema)
-- Corrige ordem: hub_migration_crm.sql cria triggers antes da função existir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hub_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;
