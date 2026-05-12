import { createClient } from "@supabase/supabase-js";

/**
 * Valida `public.users` para o utilizador do Supabase Auth (`auth_id`).
 *
 * Espelha o schema: `role public.app_role`, `status public.record_status`,
 * `email` alinhado a Auth, FK `auth_id` → `auth.users`.
 *
 * Env (regra geral, não um utilizador por variável):
 * - `LOGIN_REQUIRE_PUBLIC_USERS_ROW` ou `LOGIN_ENFORCE_APP_USERS` = `true` — exige linha com
 *   `status` ativo (`Ativo` em `record_status`) e, se o Auth enviar e-mail, igual a `users.email`.
 * - `LOGIN_ALLOWED_APP_ROLES=owner,admin` — restrige quais valores de `role` podem abrir sessão
 *   (backoffice); vazio = qualquer `app_role` desde que ativo e linha exista quando a verificação
 *   estiver ligada.
 */

function isActiveRecordStatus(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "ativo";
}

export async function verifyPublicUserForAuth(
  authUserId: string,
  authEmail?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      ok: false,
      error:
        "A verificação de perfil (public.users) está ligada no servidor mas falta SUPABASE_SERVICE_ROLE_KEY. Desligue LOGIN_ENFORCE_APP_USERS / LOGIN_REQUIRE_PUBLIC_USERS_ROW e LOGIN_ALLOWED_APP_ROLES, ou configure a service role key no ambiente.",
    };
  }

  const requireRow = loginRequiresPublicUsersRow();
  const allowedRoles = loginAllowedAppRoles();
  if (!requireRow && allowedRoles.length === 0) {
    return { ok: true };
  }

  let data: {
    id: string;
    status: unknown;
    role: unknown;
    email: string | null;
  } | null;
  let error: { message: string } | null;

  try {
    const supabase = createClient(url, key);
    const q = await supabase
      .from("users")
      .select("id, status, role, email")
      .eq("auth_id", authUserId)
      .maybeSingle();
    data = q.data as typeof data;
    error = q.error;
  } catch (err) {
    console.error("[verifyPublicUserForAuth] supabase:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Falha ao consultar public.users. Verifique rede, TLS ou políticas da base.",
    };
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error:
        "Conta sem perfil na aplicação. O administrador deve criar a sua linha em `public.users` com `auth_id` igual ao UUID do Supabase Auth.",
    };
  }

  const rowEmail = typeof data.email === "string" ? data.email.trim() : "";
  const sessionEmail = typeof authEmail === "string" ? authEmail.trim() : "";
  if (rowEmail && sessionEmail && rowEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
    return {
      ok: false,
      error:
        "O e-mail desta sessão não coincide com o cadastro em `users`. Atualize o registo na base ou use o e-mail correto.",
    };
  }

  if (requireRow || allowedRoles.length > 0) {
    if (!isActiveRecordStatus(data.status)) {
      return {
        ok: false,
        error: "Conta inativa (`record_status` diferente de Ativo). Contate o administrador.",
      };
    }
  }

  if (allowedRoles.length > 0) {
    const roleNorm = String(data.role ?? "")
      .trim()
      .toLowerCase();
    if (!roleNorm || !allowedRoles.includes(roleNorm)) {
      return {
        ok: false,
        error:
          "O seu `app_role` não tem permissão para esta área. Contate o administrador.",
      };
    }
  }

  return { ok: true };
}

export function loginRequiresPublicUsersRow(): boolean {
  const truthy = (v: string | undefined) => v?.trim().toLowerCase() === "true";
  return (
    truthy(process.env.LOGIN_REQUIRE_PUBLIC_USERS_ROW) ||
    truthy(process.env.LOGIN_ENFORCE_APP_USERS)
  );
}

/** Valores em minúsculas; comparados com `role` do banco em minúsculas. */
export function loginAllowedAppRoles(): string[] {
  const raw = process.env.LOGIN_ALLOWED_APP_ROLES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function shouldVerifyPublicUser(): boolean {
  return loginRequiresPublicUsersRow() || loginAllowedAppRoles().length > 0;
}
