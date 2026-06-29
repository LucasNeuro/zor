import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";

export type CrmSessionActor = {
  id?: string;
  email?: string;
  name?: string;
};

let cachedProfileTenantId: string | null | undefined;
let cachedWajeOwner: boolean | undefined;
let getUserInFlight: ReturnType<typeof supabase.auth.getUser> | null = null;
let acessosMeInFlight: Promise<void> | null = null;

async function getBrowserUserDeduped() {
  if (!getUserInFlight) {
    getUserInFlight = supabase.auth.getUser().finally(() => {
      getUserInFlight = null;
    });
  }
  return getUserInFlight;
}

async function ensureProfileTenantCached(base: Record<string, string>): Promise<void> {
  if (cachedProfileTenantId !== undefined) return;
  if (!acessosMeInFlight) {
    acessosMeInFlight = (async () => {
      cachedProfileTenantId = null;
      cachedWajeOwner = false;
      const { data: { user } } = await getBrowserUserDeduped();
      if (!user?.id) return;
      try {
        const res = await fetch("/api/crm/acessos/me", { headers: base });
        if (res.ok) {
          const json = (await res.json().catch(() => ({}))) as {
            data?: {
              tenant_id?: string | null;
              waje_owner?: boolean;
              user?: { tenant_id?: string | null };
            };
          };
          cachedProfileTenantId = readTenantIdFromAcessosPayload(json);
          cachedWajeOwner = json.data?.waje_owner === true;
        }
      } catch {
        /* mantém null */
      }
    })();
  }
  await acessosMeInFlight;
}

/** Limpa cache de tenant (ex.: após logout). */
export function clearCrmApiHeadersCache(): void {
  cachedProfileTenantId = undefined;
  cachedWajeOwner = undefined;
  getUserInFlight = null;
  acessosMeInFlight = null;
}

function readTenantIdFromAcessosPayload(json: {
  data?: {
    tenant_id?: string | null;
    user?: { tenant_id?: string | null };
  };
}): string | null {
  const top = json.data?.tenant_id;
  if (typeof top === "string" && top.trim()) return top.trim();
  const nested = json.data?.user?.tenant_id;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return null;
}

/** Cabeçalhos para APIs CRM / Hub — sempre com sessão e tenant da conta quando existir. */
export async function crmApiHeaders(): Promise<Record<string, string>> {
  const base = internalApiHeaders();
  const { data: { user } } = await getBrowserUserDeduped();
  if (user?.id) base["x-caller-auth-id"] = user.id;

  await ensureProfileTenantCached(base);

  if (cachedProfileTenantId) {
    base["x-tenant-id"] = cachedProfileTenantId;
  } else if (cachedWajeOwner) {
    /* plataforma sem tenant: mantém x-tenant-id do env (internalApiHeaders) */
  } else {
    delete base["x-tenant-id"];
  }

  return base;
}

/** Alias semântico — rotas `/api/hub/*` devem usar estes cabeçalhos no browser. */
export async function hubApiHeaders(): Promise<Record<string, string>> {
  return crmApiHeaders();
}

/** Cabeçalhos CRM com identidade do utilizador para auditoria (exclusões, etc.). */
export async function crmApiHeadersWithActor(actor?: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<Record<string, string>> {
  const h = await crmApiHeaders();
  if (actor?.id) h["x-user-id"] = actor.id;
  if (actor?.email) h["x-user-email"] = actor.email;
  if (actor?.name) h["x-user-name"] = actor.name;
  return h;
}

/** Fetch browser CRM/Hub com tenant e sessão da conta (preferir a `internalApiHeaders()`). */
export async function crmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authHeaders = await crmApiHeaders();
  const merged = new Headers(init?.headers);
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: merged,
  });
}

/** Perfil do utilizador logado (nome do CRM quando disponível). */
export async function getCrmSessionActor(): Promise<CrmSessionActor> {
  const { data: { user } } = await getBrowserUserDeduped();
  if (!user) return {};

  try {
    const res = await fetch("/api/crm/acessos/me", { headers: await crmApiHeaders() });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        data?: { user?: { name?: string; email?: string } };
      };
      const profile = json.data?.user;
      if (profile) {
        return {
          id: user.id,
          email: typeof profile.email === "string" ? profile.email : user.email ?? undefined,
          name: typeof profile.name === "string" ? profile.name : undefined,
        };
      }
    }
  } catch {
    /* fallback abaixo */
  }

  const meta = user.user_metadata ?? {};
  const metaName =
    typeof meta.name === "string"
      ? meta.name
      : typeof meta.full_name === "string"
        ? meta.full_name
        : undefined;

  return {
    id: user.id,
    email: user.email ?? undefined,
    name: metaName ?? user.email?.split("@")[0],
  };
}
