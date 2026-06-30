export const SUPABASE_EXTERNO_INTEGRADOR_ID = "supabase_externo" as const;

export const HUB_INT_SUPABASE_EXTERNO_CONSULTAR = "hub_int_supabase_externo_consultar";

export const SUPABASE_EXTERNO_FERRAMENTA_KEYS = [HUB_INT_SUPABASE_EXTERNO_CONSULTAR] as const;

/** Tabelas/views bloqueadas em bases externas (só leitura em tabelas explícitas). */
export const SUPABASE_EXTERNO_TABELAS_BLOQUEADAS = new Set([
  "auth",
  "storage",
  "vault",
  "pg_catalog",
  "information_schema",
]);
