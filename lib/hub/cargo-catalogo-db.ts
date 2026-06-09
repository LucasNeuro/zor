import type { SupabaseClient } from "@supabase/supabase-js";

export function isMissingColumnError(msg: string): boolean {
  return /column|schema cache|could not find|does not exist/i.test(msg);
}

export function missingColumnName(msg: string): string | null {
  const patterns = [
    /hub_cargos_catalogo\.([a-zA-Z0-9_]+)/i,
    /'([a-zA-Z0-9_]+)'\s+column\s+of\s+'hub_cargos_catalogo'/i,
    /find the '([a-zA-Z0-9_]+)' column/i,
    /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation/i,
  ];
  for (const re of patterns) {
    const m = msg.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Garante `titulo` no cliente mesmo quando a BD só tem `nome`. */
export function normalizeCargoCatalogRow<T extends Record<string, unknown>>(row: T): T & { titulo: string } {
  const titulo = String(row.titulo ?? row.nome ?? "").trim();
  return { ...row, titulo };
}

export function cargoTituloFromRow(row: Record<string, unknown>): string {
  return String(row.titulo ?? row.nome ?? "").trim();
}

/** Garante `nome` legado quando existe `titulo`; opcionalmente remove `titulo`. */
export function cargoRowForInsert(row: Record<string, unknown>, useNomeTitulo: boolean): Record<string, unknown> {
  const out = { ...row };
  const titulo = String(out.titulo ?? "").trim();
  if (titulo) out.nome = titulo;
  if (useNomeTitulo && titulo) delete out.titulo;
  return out;
}

function cargoPayloadMinimo(row: Record<string, unknown>): Record<string, unknown> {
  const titulo = String(row.titulo ?? row.nome ?? "").trim();
  const out: Record<string, unknown> = {
    slug: row.slug,
    nome: titulo || row.nome,
    area: row.area ?? "geral",
    ativo: row.ativo !== false,
  };
  const desc = String(row.descricao ?? row.descricao_curta ?? "").trim();
  if (desc) out.descricao = desc;
  if (titulo && !out.nome) out.nome = titulo;
  return out;
}

export async function listCargosCatalog(
  supabase: SupabaseClient,
  all: boolean
): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> {
  const orderAttempts = [
    ["segmento", "especialidade", "nivel"],
    ["area", "titulo"],
    ["titulo"],
    ["slug"],
    ["nome"],
    [],
  ] as const;

  let lastError: { message: string } | null = null;
  for (const cols of orderAttempts) {
    let q = supabase.from("hub_cargos_catalogo").select("*");
    if (!all) q = q.eq("ativo", true);
    for (const col of cols) q = q.order(col);
    const { data, error } = await q;
    if (!error) {
      return {
        data: (data || []).map((r) => normalizeCargoCatalogRow(r as Record<string, unknown>)),
        error: null,
      };
    }
    lastError = error;
    if (!isMissingColumnError(error.message ?? "")) break;
  }
  return { data: null, error: lastError };
}

export async function selectCargosContextoSugerir(
  supabase: SupabaseClient
): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> {
  const selectAttempts = [
    "slug,titulo,segmento,especialidade,nivel",
    "slug,nome,segmento,especialidade,nivel",
    "slug,titulo,segmento,nivel",
    "slug,nome,area,nivel",
    "slug,nome,area",
    "slug,nome",
    "slug,titulo",
    "slug",
  ];

  let lastError: { message: string } | null = null;
  for (const cols of selectAttempts) {
    const { data, error } = await supabase
      .from("hub_cargos_catalogo")
      .select(cols)
      .eq("ativo", true)
      .order("slug")
      .limit(48);
    if (!error) {
      return {
        data: (data || []).map((r) => normalizeCargoCatalogRow(r as Record<string, unknown>)),
        error: null,
      };
    }
    lastError = error;
    if (!isMissingColumnError(error.message ?? "")) break;
  }
  return { data: null, error: lastError };
}

async function insertCargoPayload(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const selectAttempts = ["*", "slug,titulo,nome,area,ativo", "slug,nome,area,ativo", "slug"];
  let lastError: { message: string } | null = null;

  for (const cols of selectAttempts) {
    const { data, error } = await supabase.from("hub_cargos_catalogo").insert(payload).select(cols).single();
    if (!error && data) {
      return { data: normalizeCargoCatalogRow(data as Record<string, unknown>), error: null };
    }
    if (!error) return { data: null, error: { message: "Insert sem retorno." } };
    lastError = error;
    if (isMissingColumnError(error.message ?? "")) continue;
    return { data: null, error };
  }
  return { data: null, error: lastError };
}

export async function insertCargoCatalogRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  let payload = cargoRowForInsert(row, false);
  let useNomeTitulo = false;
  let triedMinimal = false;
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await insertCargoPayload(supabase, payload);
    if (res.data) return res;
    lastError = res.error;
    const errMsg = res.error?.message ?? "";

    if (!isMissingColumnError(errMsg)) {
      return res;
    }

    const col = missingColumnName(errMsg);
    if (col === "titulo" && !useNomeTitulo) {
      useNomeTitulo = true;
      payload = cargoRowForInsert(payload, true);
      continue;
    }
    if (col) {
      const next = { ...payload };
      delete next[col];
      payload = next;
      continue;
    }

    if (!triedMinimal) {
      triedMinimal = true;
      payload = cargoPayloadMinimo(payload);
      continue;
    }
    break;
  }

  const detail = lastError?.message ? ` Último erro: ${lastError.message}` : "";
  return { data: null, error: { message: `Falha ao inserir cargo.${detail}` } };
}

export async function updateCargoCatalogRow(
  supabase: SupabaseClient,
  slug: string,
  patch: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  let payload = { ...patch };
  let mirrorNome = false;

  for (let attempt = 0; attempt < 24; attempt++) {
    const { data, error } = await supabase
      .from("hub_cargos_catalogo")
      .update(payload)
      .eq("slug", slug)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return { data: normalizeCargoCatalogRow(data as Record<string, unknown>), error: null };
    }
    if (!error) return { data: null, error: { message: "Cargo não encontrado após atualização." } };
    if (!isMissingColumnError(error.message ?? "")) {
      return { data: null, error };
    }

    const col = missingColumnName(error.message ?? "");
    if (col === "titulo" && typeof payload.titulo === "string" && !mirrorNome) {
      mirrorNome = true;
      payload = { ...payload, nome: payload.titulo };
      delete payload.titulo;
      continue;
    }
    if (col) {
      const next = { ...payload };
      delete next[col];
      payload = next;
      continue;
    }
    return { data: null, error };
  }

  return { data: null, error: { message: "Falha ao atualizar cargo após várias tentativas." } };
}

function erroRpcCargoNaoInstalado(msg: string): boolean {
  return /hub_delete_cargo_catalogo|PGRST202|42883|function.*does not exist/i.test(msg);
}

export type DeleteCargoResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; status: number };

/** Elimina cargo — RPC `hub_delete_cargo_catalogo` ou fallback directo (service role). */
export async function deleteCargoCatalogo(
  supabase: SupabaseClient,
  slug: string
): Promise<DeleteCargoResult> {
  const trimmed = slug.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "slug inválido", status: 400 };
  }

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc("hub_delete_cargo_catalogo", {
    p_slug: trimmed,
  });

  if (!rpcErr) {
    const row = rpcRaw as { ok?: boolean; error?: string; slug?: string } | null;
    if (row?.ok) return { ok: true, slug: String(row.slug ?? trimmed) };
    const msg = typeof row?.error === "string" ? row.error : "Falha ao eliminar.";
    let status = 500;
    if (msg.includes("Não é possível eliminar")) status = 409;
    else if (msg.includes("Cargo não encontrado")) status = 404;
    else if (msg.includes("inválido")) status = 400;
    return { ok: false, error: msg, status };
  }

  if (!erroRpcCargoNaoInstalado(rpcErr.message ?? "")) {
    return { ok: false, error: rpcErr.message, status: 500 };
  }

  const { data: cargo, error: loadErr } = await supabase
    .from("hub_cargos_catalogo")
    .select("slug,titulo,nome")
    .eq("slug", trimmed)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message, status: 500 };
  if (!cargo) return { ok: false, error: "Cargo não encontrado.", status: 404 };

  const titulo = cargoTituloFromRow(cargo as Record<string, unknown>);
  if (titulo) {
    const { count, error: countErr } = await supabase
      .from("hub_agente_identidade")
      .select("id", { count: "exact", head: true })
      .eq("cargo", titulo);

    if (countErr && !isMissingColumnError(countErr.message ?? "")) {
      return { ok: false, error: countErr.message, status: 500 };
    }
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Não é possível eliminar: ${count} agente(s) usam o cargo «${titulo}». Desactive o cargo ou actualize os agentes.`,
        status: 409,
      };
    }
  }

  const { error: delErr } = await supabase.from("hub_cargos_catalogo").delete().eq("slug", trimmed);
  if (delErr) {
    if (erroRpcCargoNaoInstalado(delErr.message ?? "")) {
      return {
        ok: false,
        error:
          "Exclusão de cargos não está instalada no Supabase. Aplique a migração 20260601120000_hub_delete_cargo_catalogo_rpc.sql no SQL Editor.",
        status: 503,
      };
    }
    return { ok: false, error: delErr.message, status: 500 };
  }

  return { ok: true, slug: trimmed };
}
