import type { NextRequest } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/** Tenant do utilizador CRM logado (`users.tenant_id`); fallback env/header. */
export async function resolveTenantIdFromCaller(request: NextRequest): Promise<string> {
  const fallbackTenant = tenantIdFromRequest(request.headers) || defaultTenantId();
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim();
  if (!callerAuthId) return fallbackTenant;

  const { data } = await crmDb()
    .from("users")
    .select("tenant_id")
    .eq("auth_id", callerAuthId)
    .maybeSingle();

  return String(data?.tenant_id ?? fallbackTenant);
}

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
};

function slugSegmento(s: string, fallback: string): string {
  const cleaned = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return cleaned || fallback;
}

/** Resolve tenant + slug (`hub_tenants.slug`) para paths no Storage. */
export async function resolveTenantContextFromCaller(request: NextRequest): Promise<TenantContext> {
  const tenantId = await resolveTenantIdFromCaller(request);
  const { data } = await crmDb().from("hub_tenants").select("slug").eq("id", tenantId).maybeSingle();
  const rawSlug = typeof data?.slug === "string" ? data.slug.trim() : "";
  return {
    tenantId,
    tenantSlug: slugSegmento(rawSlug || tenantId, "empresa"),
  };
}
