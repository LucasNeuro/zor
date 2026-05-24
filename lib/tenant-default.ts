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


/** PostgREST / Postgres sem coluna (migração ainda não aplicada no Supabase). */
export function isTenantFkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code !== "23503") return false;
  const m = (e.message || "").toLowerCase();
  return m.includes("tenant") || m.includes("hub_tenants");
}

export function isMissingPgColumn(err: unknown, column?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const m = (e.message || "").toLowerCase();
  if (e.code === "PGRST204" || e.code === "42703") {
    if (!column) return true;
    return m.includes(column.toLowerCase());
  }
  if (m.includes("schema cache")) {
    if (!column) return true;
    return m.includes(column.toLowerCase());
  }
  if (
    column &&
    m.includes(column.toLowerCase()) &&
    (m.includes("column") || m.includes("could not find"))
  ) {
    return true;
  }
  return false;
}

/**
 * Filtro PostgREST: tenant actual + registos legados (tenant_id NULL ou Obra10 padrão).
 * Parceiros antigos foram gravados sem tenant antes da migração multi-tenant.
 */
export function tenantScopeOrFilter(tenantId: string): string {
  const tid = tenantId?.trim() || DEFAULT_OBRA10_TENANT_ID;
  const parts = new Set<string>([`tenant_id.eq.${tid}`, "tenant_id.is.null"]);
  if (tid !== DEFAULT_OBRA10_TENANT_ID) {
    parts.add(`tenant_id.eq.${DEFAULT_OBRA10_TENANT_ID}`);
  }
  return [...parts].join(",");
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
