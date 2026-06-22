import type { NextRequest } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { isPlatformTeamRole } from "@/lib/auth/verify-ops-user";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export type TenantResolveResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string; status: number };

async function tenantExistsInHub(tenantId: string): Promise<boolean> {
  const tid = tenantId?.trim();
  if (!tid) return false;
  const { data, error } = await crmDb().from("hub_tenants").select("id").eq("id", tid).maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

function uuidValido(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

type CallerProfile = {
  tenantId: string | null;
  isPlatformUser: boolean;
};

async function loadCallerProfile(request: NextRequest): Promise<CallerProfile | null> {
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim();
  if (!callerAuthId) return null;

  const { data: user } = await crmDb()
    .from("users")
    .select("tenant_id, role, owner")
    .eq("auth_id", callerAuthId)
    .maybeSingle();

  if (!user) return null;

  const rawTenant = user.tenant_id;
  const tenantId =
    typeof rawTenant === "string" && rawTenant.trim() ? rawTenant.trim() : null;
  const role = String(user.role ?? "");
  const isPlatformUser = isPlatformTeamRole(role) || user.owner === true;

  return { tenantId, isPlatformUser };
}

/**
 * Resolve tenant para escritas (criar agente, etc.) com validação em `hub_tenants`.
 * Prioridade: tenant do utilizador → tenant no body (plataforma) → header/env → default.
 */
export async function resolveValidatedTenantId(
  request: NextRequest,
  options?: { bodyTenantId?: string | null },
): Promise<TenantResolveResult> {
  const caller = await loadCallerProfile(request);
  const headerTenant = tenantIdFromRequest(request.headers);
  const bodyTenantRaw = options?.bodyTenantId?.trim() ?? "";
  const bodyTenant = bodyTenantRaw && uuidValido(bodyTenantRaw) ? bodyTenantRaw : "";

  const candidates: string[] = [];
  if (caller?.tenantId) candidates.push(caller.tenantId);
  if (bodyTenant && caller?.isPlatformUser) candidates.push(bodyTenant);
  if (headerTenant) candidates.push(headerTenant);
  candidates.push(defaultTenantId());

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const tid = candidate?.trim();
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    if (await tenantExistsInHub(tid)) {
      return { ok: true, tenantId: tid };
    }
  }

  if (caller?.tenantId) {
    return {
      ok: false,
      status: 400,
      error:
        "O tenant da sua conta não está registado no sistema. Contacte o suporte ou volte a concluir o cadastro da empresa.",
    };
  }

  if (caller?.isPlatformUser) {
    return {
      ok: false,
      status: 400,
      error:
        "Utilizador de plataforma sem tenant associado. Defina DEFAULT_TENANT_ID e NEXT_PUBLIC_TENANT_ID com um UUID válido de hub_tenants (ex.: tenant do cliente), ou aceda ao CRM com uma conta de cliente.",
    };
  }

  return {
    ok: false,
    status: 400,
    error:
      "Tenant inválido ou não encontrado. Verifique o cadastro da empresa ou as variáveis DEFAULT_TENANT_ID / NEXT_PUBLIC_TENANT_ID no servidor.",
  };
}

/** Tenant do utilizador CRM logado; valida existência em `hub_tenants` quando possível. */
export async function resolveTenantIdFromCaller(request: NextRequest): Promise<string> {
  const validated = await resolveValidatedTenantId(request);
  if (validated.ok) return validated.tenantId;
  return defaultTenantId();
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
