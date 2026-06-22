import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/hub/cargo-catalogo-db";

/** Restringe consultas a cargos do tenant (ignora legado tenant_id NULL). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- evita TS2589 no builder Supabase
export function applyCargoTenantFilter(query: any, tenantId: string): any {
  return query.eq("tenant_id", tenantId);
}

export async function cargoSlugExistsForTenant(
  supabase: SupabaseClient,
  slug: string,
  tenantId: string
): Promise<{ exists: boolean; columnMissing: boolean }> {
  let q = supabase.from("hub_cargos_catalogo").select("slug").eq("slug", slug.trim());
  q = applyCargoTenantFilter(q, tenantId);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isMissingColumnError(error.message ?? "")) {
      return { exists: false, columnMissing: true };
    }
    throw new Error(error.message);
  }
  return { exists: Boolean(data), columnMissing: false };
}
