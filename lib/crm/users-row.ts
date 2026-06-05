/** Normaliza colunas de `public.users` entre esquemas (criado_em vs created_at). */

export type UserRow = Record<string, unknown>;

export function normalizeUserRow(row: UserRow | null): UserRow | null {
  if (!row || typeof row !== "object") return row;
  const criado = row.criado_em ?? row.created_at ?? null;
  const atualizado = row.atualizado_em ?? row.updated_at ?? null;
  return {
    ...row,
    criado_em: criado,
    atualizado_em: atualizado,
    created_at: row.created_at ?? criado,
    updated_at: row.updated_at ?? atualizado,
  };
}

export function userUpdateTimestamp(): Record<string, string> {
  const now = new Date().toISOString();
  return { atualizado_em: now, updated_at: now };
}

/** Aplica update com fallback se a base só tiver created_at/updated_at. */
export async function updateUserByAuthId(
  db: ReturnType<typeof import("@/lib/crm/supabase-server").crmDb>,
  authId: string,
  fields: Record<string, unknown>,
): Promise<{ data: UserRow | null; error: { message: string } | null }> {
  const withPt = { ...fields, ...userUpdateTimestamp() };
  let res = await db.from("users").update(withPt).eq("auth_id", authId).select("*").maybeSingle();
  if (res.error && /atualizado_em|criado_em/i.test(res.error.message)) {
    const { atualizado_em: _a, criado_em: _c, ...rest } = withPt;
    const withEn = { ...rest, updated_at: new Date().toISOString() };
    res = await db.from("users").update(withEn).eq("auth_id", authId).select("*").maybeSingle();
  }
  if (res.error && /updated_at|created_at/i.test(res.error.message)) {
    const { updated_at: _u, created_at: _c, ...restOnly } = fields;
    res = await db.from("users").update(restOnly).eq("auth_id", authId).select("*").maybeSingle();
  }
  return {
    data: normalizeUserRow(res.data as UserRow | null),
    error: res.error,
  };
}
