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
