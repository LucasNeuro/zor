/** Compatibilidade com bases Supabase sem todas as colunas de hub_agente_identidade. */

export function isPostgrestColumnMissing(message?: string, column?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (
    !m.includes("does not exist") &&
    !m.includes("schema cache") &&
    !m.includes("could not find")
  ) {
    return false;
  }
  if (!m.includes("hub_agente_identidade")) return false;
  if (column) return m.includes(column.toLowerCase());
  return true;
}

/** Extrai nome da coluna em erros Postgres/PostgREST. */
export function missingHubAgenteColumn(message?: string): string | null {
  if (!message) return null;
  const m = message.match(/hub_agente_identidade\.([a-z0-9_]+)/i);
  return m?.[1] ?? null;
}

export function removeSelectColumn(select: string, column: string): string {
  const parts = select
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== column);
  return parts.join(", ");
}

/** Tenta SELECT com remoção progressiva de colunas ausentes (máx. 8 tentativas). */
export async function selectHubAgenteWithColumnFallback<T>(
  run: (columns: string) => Promise<{ data: T | null; error: { message?: string } | null }>,
  initialColumns: string
): Promise<{ data: T | null; error: { message?: string } | null }> {
  let cols = initialColumns;
  let last = await run(cols);
  for (let i = 0; i < 8; i++) {
    if (!last.error) return last;
    const missing = missingHubAgenteColumn(last.error.message);
    if (!missing || !isPostgrestColumnMissing(last.error.message, missing)) return last;
    const next = removeSelectColumn(cols, missing);
    if (next === cols || next.length === 0) return last;
    cols = next;
    last = await run(cols);
  }
  return last;
}
