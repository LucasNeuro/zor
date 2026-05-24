/**
 * Cabeçalho esperado pelo `proxy.ts` para rotas /api internas (alternativa: sessão Supabase no browser).
 * No cliente use NEXT_PUBLIC_INTERNAL_API_KEY (mesmo valor que INTERNAL_API_KEY).
 */
export function internalApiHeaders(): Record<string, string> {
  const key =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_INTERNAL_API_KEY
      : process.env.INTERNAL_API_KEY;
  const tenantId =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_TENANT_ID
      : process.env.DEFAULT_TENANT_ID;
  const h: Record<string, string> = {};
  if (key) h["x-api-key"] = key;
  if (tenantId) h["x-tenant-id"] = tenantId;
  return h;
}

/** Inclui identidade do utilizador CRM para auditoria (exclusões, etc.). */
export function internalApiHeadersWithActor(actor?: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}): Record<string, string> {
  const h = internalApiHeaders();
  if (actor?.id) h["x-user-id"] = actor.id;
  if (actor?.email) h["x-user-email"] = actor.email;
  if (actor?.name) h["x-user-name"] = actor.name;
  return h;
}
