import type { SupabaseClient } from "@supabase/supabase-js";

export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  targetEmail: string
): Promise<{ id: string; user_metadata?: Record<string, unknown> } | null> {
  const email = targetEmail.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit?.id) {
      return { id: hit.id, user_metadata: (hit.user_metadata ?? {}) as Record<string, unknown> };
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

export async function ensureAuthUserWithPassword(
  supabase: SupabaseClient,
  params: { email: string; password: string; name: string }
): Promise<{ ok: true; authId: string } | { ok: false; error: string }> {
  const email = params.email.trim().toLowerCase();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: { name: params.name },
  });

  if (!createErr && created.user?.id) {
    return { ok: true, authId: created.user.id };
  }

  let authUser: { id: string; user_metadata?: Record<string, unknown> } | null = null;
  try {
    authUser = await findAuthUserByEmail(supabase, email);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao procurar utilizador no Auth." };
  }

  if (!authUser) {
    return { ok: false, error: createErr?.message ?? "Não foi possível criar utilizador." };
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: params.password,
    email_confirm: true,
    user_metadata: { ...(authUser.user_metadata ?? {}), name: params.name },
  });

  if (updateErr) return { ok: false, error: updateErr.message };
  return { ok: true, authId: authUser.id };
}
