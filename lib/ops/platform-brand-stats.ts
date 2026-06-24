import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformBrandStats = {
  tenants_total: number;
  tenants_ativos: number;
  usuarios_total: number;
  usuarios_ativos: number;
};

export type PlatformBrandUserRow = {
  id: string;
  email: string;
  name: string;
  status: string;
  tenant_id: string | null;
  tenant_nome: string | null;
};

function isUserAtivo(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "ativo" || s === "active";
}

/** Agrupa tenants e users por platform_brand_id (null → marca principal). */
export async function loadPlatformBrandStatsMap(
  db: SupabaseClient,
  principalBrandId: string | null
): Promise<Map<string, PlatformBrandStats>> {
  const stats = new Map<string, PlatformBrandStats>();

  const empty = (): PlatformBrandStats => ({
    tenants_total: 0,
    tenants_ativos: 0,
    usuarios_total: 0,
    usuarios_ativos: 0,
  });

  const bump = (brandKey: string, patch: Partial<PlatformBrandStats>) => {
    const cur = stats.get(brandKey) ?? empty();
    stats.set(brandKey, {
      tenants_total: cur.tenants_total + (patch.tenants_total ?? 0),
      tenants_ativos: cur.tenants_ativos + (patch.tenants_ativos ?? 0),
      usuarios_total: cur.usuarios_total + (patch.usuarios_total ?? 0),
      usuarios_ativos: cur.usuarios_ativos + (patch.usuarios_ativos ?? 0),
    });
  };

  const { data: tenants, error: tErr } = await db
    .from("hub_tenants")
    .select("id, ativo, platform_brand_id");

  if (tErr) throw new Error(tErr.message);

  const tenantBrand = new Map<string, string>();
  for (const t of tenants ?? []) {
    const tid = String(t.id);
    const brandKey =
      t.platform_brand_id != null
        ? String(t.platform_brand_id)
        : principalBrandId ?? "__sem_marca__";
    tenantBrand.set(tid, brandKey);
    bump(brandKey, {
      tenants_total: 1,
      tenants_ativos: t.ativo !== false ? 1 : 0,
    });
  }

  const { data: users, error: uErr } = await db
    .from("users")
    .select("id, tenant_id, status, owner");

  if (uErr) throw new Error(uErr.message);

  for (const u of users ?? []) {
    if (u.owner === true) continue;
    const tid = u.tenant_id != null ? String(u.tenant_id) : null;
    if (!tid) continue;
    const brandKey = tenantBrand.get(tid);
    if (!brandKey) continue;
    bump(brandKey, {
      usuarios_total: 1,
      usuarios_ativos: isUserAtivo(u.status) ? 1 : 0,
    });
  }

  return stats;
}

export async function loadPlatformBrandUsers(
  db: SupabaseClient,
  brandId: string,
  principalBrandId: string | null
): Promise<{ stats: PlatformBrandStats; usuarios: PlatformBrandUserRow[] }> {
  let tenantQuery = db.from("hub_tenants").select("id, nome_exibicao, slug, ativo");

  if (principalBrandId && brandId === principalBrandId) {
    tenantQuery = tenantQuery.or(`platform_brand_id.eq.${brandId},platform_brand_id.is.null`);
  } else {
    tenantQuery = tenantQuery.eq("platform_brand_id", brandId);
  }

  const { data: tenants, error: tErr } = await tenantQuery;
  if (tErr) throw new Error(tErr.message);

  const tenantIds = (tenants ?? []).map((t) => String(t.id));
  const tenantNome = new Map(
    (tenants ?? []).map((t) => [String(t.id), String(t.nome_exibicao ?? t.slug ?? "")])
  );

  const stats: PlatformBrandStats = {
    tenants_total: tenants?.length ?? 0,
    tenants_ativos: (tenants ?? []).filter((t) => t.ativo !== false).length,
    usuarios_total: 0,
    usuarios_ativos: 0,
  };

  if (tenantIds.length === 0) {
    return { stats, usuarios: [] };
  }

  const { data: users, error: uErr } = await db
    .from("users")
    .select("id, email, name, status, tenant_id, owner")
    .in("tenant_id", tenantIds)
    .order("email");

  if (uErr) throw new Error(uErr.message);

  const usuarios: PlatformBrandUserRow[] = [];
  for (const u of users ?? []) {
    if (u.owner === true) continue;
    stats.usuarios_total += 1;
    if (isUserAtivo(u.status)) stats.usuarios_ativos += 1;
    usuarios.push({
      id: String(u.id),
      email: String(u.email ?? ""),
      name: String(u.name ?? ""),
      status: String(u.status ?? ""),
      tenant_id: u.tenant_id != null ? String(u.tenant_id) : null,
      tenant_nome: u.tenant_id ? tenantNome.get(String(u.tenant_id)) ?? null : null,
    });
  }

  return { stats, usuarios };
}
