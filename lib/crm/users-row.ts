/** Normaliza colunas de `public.users` entre esquemas (criado_em vs created_at). */

export type UserRow = Record<string, unknown>;

export const DB_RECORD_STATUSES = ["Ativo", "Inativo", "Arquivado"] as const;
export type DbRecordStatus = (typeof DB_RECORD_STATUSES)[number];

/** Valor aceite pelo enum PostgreSQL `record_status`. */
export function toDbRecordStatus(status?: string | null): DbRecordStatus {
  const s = String(status ?? "ativo").trim().toLowerCase();
  if (s === "inativo") return "Inativo";
  if (s === "arquivado") return "Arquivado";
  return "Ativo";
}

/** Normaliza status para UI/API (minúsculas). */
export function normalizeRecordStatus(status: unknown): string {
  const s = String(status ?? "").trim();
  if (!s) return "ativo";
  const lower = s.toLowerCase();
  if (lower === "ativo" || lower === "inativo" || lower === "arquivado") return lower;
  if (s === "Ativo") return "ativo";
  if (s === "Inativo") return "inativo";
  if (s === "Arquivado") return "arquivado";
  return lower;
}

function withDbRecordStatus(fields: Record<string, unknown>): Record<string, unknown> {
  if (!("status" in fields) || fields.status == null) return fields;
  return { ...fields, status: toDbRecordStatus(String(fields.status)) };
}

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
    status: normalizeRecordStatus(row.status),
  };
}

export function userUpdateTimestamp(): Record<string, string> {
  const now = new Date().toISOString();
  return { atualizado_em: now, updated_at: now };
}

type SupabaseLike = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
  };
};

function isMissingPtTimestampColumn(message: string): boolean {
  return /atualizado_em|criado_em/i.test(message);
}

function isMissingEnTimestampColumn(message: string): boolean {
  return /updated_at|created_at/i.test(message);
}

function stripPtTimestamps(payload: Record<string, unknown>): Record<string, unknown> {
  const { atualizado_em: _a, criado_em: _c, ...rest } = payload;
  return { ...rest, updated_at: new Date().toISOString() };
}

function stripEnTimestamps(payload: Record<string, unknown>): Record<string, unknown> {
  const { updated_at: _u, created_at: _c, ...rest } = payload;
  return rest;
}

type UsersDb = {
  from: (table: string) => {
    update: (payload: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        is?: (col2: string, val2: null) => {
          select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
        select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
    upsert: (
      payload: Record<string, unknown>,
      opts: { onConflict: string }
    ) => {
      select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    };
  };
};

/** Aplica update com fallback se a base só tiver created_at/updated_at. */
export async function updateUserByAuthId(
  db: SupabaseLike,
  authId: string,
  fields: Record<string, unknown>,
): Promise<{ data: UserRow | null; error: { message: string } | null }> {
  const withPt = { ...withDbRecordStatus(fields), ...userUpdateTimestamp() };
  let res = await db.from("users").update(withPt).eq("auth_id", authId).select("*").maybeSingle();
  if (res.error && isMissingPtTimestampColumn(res.error.message)) {
    res = await db
      .from("users")
      .update(stripPtTimestamps(withPt))
      .eq("auth_id", authId)
      .select("*")
      .maybeSingle();
  }
  if (res.error && isMissingEnTimestampColumn(res.error.message)) {
    res = await db.from("users").update(stripEnTimestamps(withDbRecordStatus(fields))).eq("auth_id", authId).select("*").maybeSingle();
  }
  return {
    data: normalizeUserRow(res.data as UserRow | null),
    error: res.error,
  };
}

export async function updateUserById(
  db: UsersDb,
  id: string,
  fields: Record<string, unknown>,
  opts?: { tenantId?: string | null; onlyOrphan?: boolean }
): Promise<{ data: UserRow | null; error: { message: string } | null }> {
  const normalizedFields = withDbRecordStatus(fields);
  const withPt = { ...normalizedFields, ...userUpdateTimestamp() };

  const runUpdate = (payload: Record<string, unknown>) => {
    let q = db.from("users").update(payload).eq("id", id);
    if (opts?.tenantId) q = q.eq("tenant_id", opts.tenantId) as typeof q;
    if (opts?.onlyOrphan) q = q.is("tenant_id", null) as typeof q;
    return q.select("*").maybeSingle();
  };

  let res = await runUpdate(withPt);
  if (res.error && isMissingPtTimestampColumn(res.error.message)) {
    res = await runUpdate(stripPtTimestamps(withPt));
  }
  if (res.error && isMissingEnTimestampColumn(res.error.message)) {
    res = await runUpdate(stripEnTimestamps(normalizedFields));
  }

  return {
    data: normalizeUserRow(res.data as UserRow | null),
    error: res.error,
  };
}

export async function upsertUserByAuthId(
  db: UsersDb,
  fields: Record<string, unknown>
): Promise<{ data: UserRow | null; error: { message: string } | null }> {
  const normalizedFields = withDbRecordStatus(fields);
  const withPt = { ...normalizedFields, ...userUpdateTimestamp() };

  const runUpsert = (payload: Record<string, unknown>) =>
    db.from("users").upsert(payload, { onConflict: "auth_id" }).select("*").single();

  let res = await runUpsert(withPt);
  if (res.error && isMissingPtTimestampColumn(res.error.message)) {
    res = await runUpsert(stripPtTimestamps(withPt));
  }
  if (res.error && isMissingEnTimestampColumn(res.error.message)) {
    res = await runUpsert(stripEnTimestamps(normalizedFields));
  }

  return {
    data: normalizeUserRow(res.data as UserRow | null),
    error: res.error,
  };
}
