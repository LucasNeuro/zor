/** UUID fixo do tenant legado Obra10+ em `hub_tenants` (ver migrações Supabase). */
export const DEFAULT_OBRA10_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** Tenant usado por rotas server quando não há resolução por host/JWT. */
export function defaultTenantId(): string {
  const fromEnv = process.env.DEFAULT_TENANT_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_OBRA10_TENANT_ID;
}

function headerUuidValido(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}


/** PostgREST sem coluna (ex.: migração tenant_id ainda não aplicada). */
export function isMissingPgColumn(err: unknown, column?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "PGRST204") {
    if (!column) return true;
    return (e.message || "").toLowerCase().includes(column.toLowerCase());
  }
  const m = (e.message || "").toLowerCase();
  if (column && m.includes(column.toLowerCase())) return true;
  return m.includes("schema cache");
}

export function tenantIdFromRequest(headers: Headers): string {
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  const requestKey = headers.get("x-api-key")?.trim();
  const requestedTenant = headers.get("x-tenant-id")?.trim();

  if (internalKey && requestKey === internalKey && requestedTenant) {
    return requestedTenant;
  }

  if (requestedTenant && headerUuidValido(requestedTenant)) {
    return requestedTenant;
  }

  return defaultTenantId();
}
