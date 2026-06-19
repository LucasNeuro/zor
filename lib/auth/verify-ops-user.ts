import { crmDb } from "@/lib/crm/supabase-server";
import { isMissingPgColumn } from "@/lib/tenant-default";

const OPS_ROLE_LEGACY = "platform_admin";

/** E-mails autorizados via env (bootstrap antes de marcar owner no banco). */
export function opsAllowedEmails(): string[] {
  const raw = process.env.WAJE_OPS_ALLOWED_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isActiveStatus(status: unknown): boolean {
  return String(status ?? "")
    .trim()
    .toLowerCase() === "ativo";
}

function isTruthyOwner(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Valida acesso ao console operacional Waje.
 * Prioridade: `owner = true` em public.users → role legado platform_admin → WAJE_OPS_ALLOWED_EMAILS.
 */
export async function verifyOpsUserForAuth(
  authUserId: string,
  authEmail?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowlist = opsAllowedEmails();
  const sessionEmail = typeof authEmail === "string" ? authEmail.trim().toLowerCase() : "";

  if (allowlist.length > 0 && sessionEmail && allowlist.includes(sessionEmail)) {
    return { ok: true };
  }

  let query = await crmDb()
    .from("users")
    .select("role, status, email, owner")
    .eq("auth_id", authUserId)
    .maybeSingle();

  if (query.error && isMissingPgColumn(query.error, "owner")) {
    query = await crmDb()
      .from("users")
      .select("role, status, email")
      .eq("auth_id", authUserId)
      .maybeSingle();
  }

  const { data, error } = query;

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    if (allowlist.length > 0) {
      return {
        ok: false,
        error: "E-mail não autorizado para operações Waje. Contate o administrador da plataforma.",
      };
    }
    return {
      ok: false,
      error:
        "Conta sem perfil operacional. Marque owner = true em public.users no Supabase ou configure WAJE_OPS_ALLOWED_EMAILS.",
    };
  }

  if (!isActiveStatus(data.status)) {
    return { ok: false, error: "Conta inativa. Contate o administrador da plataforma." };
  }

  if (isTruthyOwner((data as { owner?: unknown }).owner)) {
    return { ok: true };
  }

  const roleNorm = String(data.role ?? "")
    .trim()
    .toLowerCase();
  if (roleNorm === OPS_ROLE_LEGACY) {
    return { ok: true };
  }

  if (allowlist.length > 0) {
    const rowEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (rowEmail && sessionEmail && rowEmail === sessionEmail && allowlist.includes(rowEmail)) {
      return { ok: true };
    }
    return {
      ok: false,
      error: "Sem permissão para o console operacional Waje.",
    };
  }

  return {
    ok: false,
    error: "Apenas utilizadores com owner = true na tabela users podem aceder ao console operacional.",
  };
}

/** @deprecated Preferir coluna users.owner; mantido para compatibilidade. */
export function isPlatformAdminRole(role: string): boolean {
  return role.trim().toLowerCase() === OPS_ROLE_LEGACY;
}

export function isOpsOwnerFlag(value: unknown): boolean {
  return isTruthyOwner(value);
}

/** Sidebar /crm/waje e APIs ops — alinhado com verifyOpsUserForAuth. */
export function resolveWajePlatformOwner(
  user: { role?: unknown; email?: unknown; owner?: unknown; status?: unknown } | null,
  sessionEmail?: string | null,
): boolean {
  const allowlist = opsAllowedEmails();
  const emailNorm =
    typeof sessionEmail === "string"
      ? sessionEmail.trim().toLowerCase()
      : typeof user?.email === "string"
        ? user.email.trim().toLowerCase()
        : "";

  if (allowlist.length > 0 && emailNorm && allowlist.includes(emailNorm)) {
    return true;
  }

  if (!user) return false;

  if (user.status != null && !isActiveStatus(user.status)) return false;

  if (isTruthyOwner(user.owner)) return true;

  const roleNorm = String(user.role ?? "")
    .trim()
    .toLowerCase();
  if (roleNorm === OPS_ROLE_LEGACY) return true;

  if (allowlist.length > 0 && emailNorm && allowlist.includes(emailNorm)) {
    return true;
  }

  return false;
}
