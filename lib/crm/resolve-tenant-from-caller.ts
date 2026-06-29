import type { NextRequest } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  isOpsOwnerFlag,
  isPlatformTeamRole,
  resolveWajePlatformOwner,
} from "@/lib/auth/verify-ops-user";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { hostFromRequest, resolvePlatformBrand } from "@/lib/platform-brands";

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
  isWajePlatform: boolean;
};

async function loadCallerProfile(request: NextRequest): Promise<CallerProfile | null> {
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim();
  if (!callerAuthId) return null;

  const { data: user } = await crmDb()
    .from("users")
    .select("tenant_id, role, owner, email, status")
    .eq("auth_id", callerAuthId)
    .maybeSingle();

  if (!user) return null;

  const rawTenant = user.tenant_id;
  const tenantId =
    typeof rawTenant === "string" && rawTenant.trim() ? rawTenant.trim() : null;

  const isWajePlatform = resolveWajePlatformOwner(
    user as { role?: unknown; email?: unknown; owner?: unknown; status?: unknown },
    request.headers.get("x-user-email"),
  );

  return { tenantId, isWajePlatform };
}

async function firstValidTenant(candidates: string[]): Promise<string | null> {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const tid = candidate?.trim();
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    if (await tenantExistsInHub(tid)) return tid;
  }
  return null;
}

/** Tenant activo ligado à marca white-label do host (ex.: synkronia.com.br → Synkron). */
async function resolveTenantFromBrandHost(request: NextRequest): Promise<string | null> {
  const host = hostFromRequest(request);
  if (!host) return null;
  try {
    const brand = await resolvePlatformBrand(host);

    const lookupByBrandId = async (brandId: string): Promise<string | null> => {
      const { data } = await crmDb()
        .from("hub_tenants")
        .select("id")
        .eq("platform_brand_id", brandId)
        .eq("ativo", true)
        .order("criado_em", { ascending: true })
        .limit(1)
        .maybeSingle();
      const id = typeof data?.id === "string" ? data.id.trim() : "";
      return id || null;
    };

    if (brand.id) {
      const fromId = await lookupByBrandId(brand.id);
      if (fromId) return fromId;
    }

    if (brand.slug?.trim()) {
      const { data: brandRow } = await crmDb()
        .from("hub_platform_brands")
        .select("id")
        .eq("slug", brand.slug.trim())
        .eq("ativo", true)
        .maybeSingle();
      const brandId = typeof brandRow?.id === "string" ? brandRow.id.trim() : "";
      if (brandId) {
        const fromSlug = await lookupByBrandId(brandId);
        if (fromSlug) return fromSlug;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve tenant para Hub (agentes, ciclos, ferramentas) com validação em `hub_tenants`.
 *
 * Clientes com `users.tenant_id` usam **só** o tenant da conta — nunca o DEFAULT_TENANT_ID do servidor.
 * Equipe plataforma (sem tenant) pode usar header/env ou `tenant_id` no body.
 */
export async function resolveValidatedTenantId(
  request: NextRequest,
  options?: { bodyTenantId?: string | null },
): Promise<TenantResolveResult> {
  const caller = await loadCallerProfile(request);
  const headerTenant = tenantIdFromRequest(request.headers);
  const bodyTenantRaw = options?.bodyTenantId?.trim() ?? "";
  const bodyTenant = bodyTenantRaw && uuidValido(bodyTenantRaw) ? bodyTenantRaw : "";

  if (caller?.tenantId) {
    if (await tenantExistsInHub(caller.tenantId)) {
      return { ok: true, tenantId: caller.tenantId };
    }
    return {
      ok: false,
      status: 400,
      error:
        "O tenant da sua conta não está registado no sistema. Contacte o suporte ou volte a concluir o cadastro da empresa.",
    };
  }

  const fallbackCandidates: string[] = [];
  if (bodyTenant && caller?.isWajePlatform) fallbackCandidates.push(bodyTenant);
  const fromBrandHost = await resolveTenantFromBrandHost(request);
  if (fromBrandHost) fallbackCandidates.push(fromBrandHost);
  if (headerTenant) fallbackCandidates.push(headerTenant);
  fallbackCandidates.push(defaultTenantId());

  const resolved = await firstValidTenant(fallbackCandidates);
  if (resolved) {
    return { ok: true, tenantId: resolved };
  }

  if (caller?.isWajePlatform) {
    return {
      ok: false,
      status: 400,
      error:
        "Utilizador de plataforma sem tenant associado. Defina DEFAULT_TENANT_ID e NEXT_PUBLIC_TENANT_ID com um UUID válido de hub_tenants, ou aceda ao CRM com uma conta de cliente.",
    };
  }

  if (caller) {
    return {
      ok: false,
      status: 400,
      error:
        "Conta sem empresa vinculada. Conclua o cadastro em /cadastro ou peça ao administrador para associar o seu utilizador a um tenant.",
    };
  }

  return {
    ok: false,
    status: 400,
    error:
      "Tenant inválido ou não encontrado. Inicie sessão no CRM ou verifique DEFAULT_TENANT_ID / NEXT_PUBLIC_TENANT_ID no servidor.",
  };
}

/** Atalho para rotas Hub: devolve tenant validado ou null. */
export async function resolveHubTenantId(request: NextRequest): Promise<string | null> {
  const resolved = await resolveValidatedTenantId(request);
  return resolved.ok ? resolved.tenantId : null;
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

/** Utilizário de equipe Waje (console plataforma), não confundir com role CRM `owner` do tenant. */
export function isWajePlatformCaller(user: {
  role?: unknown;
  owner?: unknown;
  tenant_id?: unknown;
} | null): boolean {
  if (!user) return false;
  const hasTenant =
    typeof user.tenant_id === "string" && user.tenant_id.trim().length > 0;
  if (hasTenant) return false;
  return (
    resolveWajePlatformOwner(user) ||
    isPlatformTeamRole(String(user.role ?? "")) ||
    isOpsOwnerFlag(user.owner)
  );
}
