/** Coluna avatar_url — supabase/migrations/20260511120000_hub_agente_avatar_url.sql */

export function isAvatarUrlColumnMissing(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("avatar_url") || !m.includes("hub_agente_identidade")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}

export function omitAvatarUrlKey(row: Record<string, unknown>): Record<string, unknown> {
  const { avatar_url: _omit, ...rest } = row;
  return rest;
}
