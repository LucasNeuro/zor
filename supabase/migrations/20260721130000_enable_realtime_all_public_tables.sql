-- Activa Supabase Realtime em todas as tabelas do schema public.
-- Executar no SQL Editor do Supabase (produção) se ainda não aplicou via CLI.
--
-- Notas:
-- 1. Realtime respeita RLS — cada cliente só recebe eventos permitidos pelas policies.
-- 2. Tabelas sem PK podem falhar; o bloco ignora erros e regista NOTICE.
-- 3. REPLICA IDENTITY FULL permite payloads completos em UPDATE/DELETE (útil p/ UI live).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS fqname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
      AND c.relname NOT LIKE 'sql_%'
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s REPLICA IDENTITY FULL', r.fqname);
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'REPLICA IDENTITY ignorado em %: %', r.fqname, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', r.fqname);
      RAISE NOTICE 'Realtime activo: %', r.fqname;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Realtime já activo: %', r.fqname;
      WHEN others THEN
        RAISE NOTICE 'Realtime ignorado em %: %', r.fqname, SQLERRM;
    END;
  END LOOP;
END $$;
