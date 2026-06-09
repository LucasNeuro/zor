import type { SupabaseClient } from "@supabase/supabase-js";

/** Extrai nome da coluna em erros PostgREST / Postgres para hub_agente_identidade. */
export function parseHubAgenteIdentidadeMissingColumn(message?: string): string | null {
  if (!message) return null;
  const m = message;
  let match = m.match(/could not find the '([^']+)' column of 'hub_agente_identidade'/i);
  if (match?.[1]) return match[1];
  match = m.match(/column "([^"]+)" of relation "hub_agente_identidade" does not exist/i);
  if (match?.[1]) return match[1];
  match = m.match(/column hub_agente_identidade\.([a-z0-9_]+) does not exist/i);
  if (match?.[1]) return match[1];
  return null;
}

export function omitHubAgenteColumn(
  row: Record<string, unknown>,
  column: string
): Record<string, unknown> {
  const { [column]: _omit, ...rest } = row;
  return rest;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

const MAX_SCHEMA_COMPAT_RETRIES = 32;

export async function insertHubAgenteIdentidadeCompat(
  supabase: SupabaseClient,
  initialRow: Record<string, unknown>,
  opts?: {
    onBeforeRetry?: (row: Record<string, unknown>, reason: string) => Record<string, unknown>;
  }
): Promise<DbResult<Record<string, unknown>>> {
  let rowInsert = { ...initialRow };

  for (let attempt = 0; attempt < MAX_SCHEMA_COMPAT_RETRIES; attempt++) {
    const { data, error } = await supabase
      .from("hub_agente_identidade")
      .insert(rowInsert)
      .select()
      .single();

    if (!error && data) {
      return { data: data as Record<string, unknown>, error: null };
    }
    if (!error) {
      return { data: null, error: { message: "Insert sem erro mas sem linha devolvida." } };
    }

    const missingCol = parseHubAgenteIdentidadeMissingColumn(error.message);
    if (missingCol && Object.prototype.hasOwnProperty.call(rowInsert, missingCol)) {
      console.warn(
        `[hub/agentes] hub_agente_identidade sem coluna «${missingCol}»; aplicar 20260621130000_ensure_hub_agente_identidade_waje_wizard.sql. Retry sem campo.`
      );
      rowInsert = omitHubAgenteColumn(rowInsert, missingCol);
      continue;
    }

    if (opts?.onBeforeRetry) {
      const next = opts.onBeforeRetry(rowInsert, error.message);
      if (next !== rowInsert) {
        rowInsert = next;
        continue;
      }
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: { message: "Número máximo de tentativas de insert em hub_agente_identidade excedido." },
  };
}

export async function selectHubAgenteIdentidadeCompat(
  supabase: SupabaseClient,
  slug: string,
  columns: string[]
): Promise<DbResult<Record<string, unknown>>> {
  let cols = [...new Set(columns.map((c) => c.trim()).filter(Boolean))];

  for (let attempt = 0; attempt < MAX_SCHEMA_COMPAT_RETRIES; attempt++) {
    if (cols.length === 0) {
      return { data: null, error: { message: "Nenhuma coluna válida para select após compatibilidade." } };
    }

    const { data, error } = await supabase
      .from("hub_agente_identidade")
      .select(cols.join(", "))
      .eq("agente_slug", slug)
      .maybeSingle();

    if (!error) {
      return { data: (data as Record<string, unknown> | null) ?? null, error: null };
    }

    const missingCol = parseHubAgenteIdentidadeMissingColumn(error.message);
    if (missingCol && cols.includes(missingCol)) {
      console.warn(
        `[hub/agentes/:slug] hub_agente_identidade sem coluna «${missingCol}»; retry select sem campo.`
      );
      cols = cols.filter((c) => c !== missingCol);
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: { message: "Número máximo de tentativas de select em hub_agente_identidade excedido." },
  };
}

export async function updateHubAgenteIdentidadeCompat(
  supabase: SupabaseClient,
  slug: string,
  initialPatch: Record<string, unknown>
): Promise<DbResult<Record<string, unknown>>> {
  let patch = { ...initialPatch };

  for (let attempt = 0; attempt < MAX_SCHEMA_COMPAT_RETRIES; attempt++) {
    if (Object.keys(patch).length === 0) {
      return { data: null, error: { message: "Nenhum campo válido para atualizar após compatibilidade." } };
    }

    const { data, error } = await supabase
      .from("hub_agente_identidade")
      .update(patch)
      .eq("agente_slug", slug)
      .select()
      .maybeSingle();

    if (!error) {
      return { data: (data as Record<string, unknown> | null) ?? null, error: null };
    }

    const missingCol = parseHubAgenteIdentidadeMissingColumn(error.message);
    if (missingCol && Object.prototype.hasOwnProperty.call(patch, missingCol)) {
      console.warn(
        `[hub/agentes/:slug] hub_agente_identidade sem coluna «${missingCol}»; retry update sem campo.`
      );
      patch = omitHubAgenteColumn(patch, missingCol);
      continue;
    }

    return { data: null, error };
  }

  return {
    data: null,
    error: { message: "Número máximo de tentativas de update em hub_agente_identidade excedido." },
  };
}
