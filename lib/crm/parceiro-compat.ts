import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn, isTenantFkError } from "@/lib/tenant-default";

type CompatError = {
  message: string;
  code?: string;
};

export type ParceiroCompatRow = {
  id: string;
  codigo?: string | null;
  nome?: string | null;
};

type ParceiroCompatInsertResult =
  | { data: ParceiroCompatRow; error: null }
  | { data: null; error: CompatError };

const PARCEIRO_INSERT_OPTIONAL_COLUMNS = [
  "tenant_id",
  "codigo",
  "indicado_por",
  "email",
  "cpf",
  "cnpj",
  "especialidade",
  "mercado",
  "cidade",
  "estado",
  "comissao_pct",
  "status",
] as const;

const PARCEIRO_CAPTACAO_OPTIONAL_COLUMNS = [
  "estagio",
  "origem",
  "canal",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "tenant_id",
] as const;

const PARCEIRO_LOG_OPTIONAL_COLUMNS = [
  "descricao",
  "feito_por",
  "feito_por_tipo",
  "dados",
  "tenant_id",
] as const;

function isMissingTable(err: unknown, table: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const msg = String(e.message || "");
  return String(e.code || "") === "PGRST205" || msg.includes(table);
}

function normalizeParceiroCompatRow(data: unknown): ParceiroCompatRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  if (!id) return null;
  return {
    id,
    codigo: typeof row.codigo === "string" ? row.codigo : null,
    nome: typeof row.nome === "string" ? row.nome : null,
  };
}

export async function insertParceiroCompat(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId?: string | null
): Promise<ParceiroCompatInsertResult> {
  const baseRow = { ...row };
  let withTenant = !!tenantId;
  let payload: Record<string, unknown> =
    withTenant && tenantId ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
  let selectCols = "id, codigo, nome";
  let lastError: { message?: string; code?: string } | null = null;

  for (let attempt = 0; attempt < PARCEIRO_INSERT_OPTIONAL_COLUMNS.length + 5; attempt++) {
    const { data, error } = await supabase
      .from("hub_parceiros")
      .insert(payload)
      .select(selectCols)
      .single();

    if (!error) {
      const normalized = normalizeParceiroCompatRow(data);
      if (normalized) return { data: normalized, error: null };
      return {
        data: null,
        error: {
          message: "Resposta invalida ao gravar hub_parceiros.",
        },
      };
    }
    lastError = error;

    if (isTenantFkError(error) || isMissingPgColumn(error, "tenant_id")) {
      withTenant = false;
      delete baseRow.tenant_id;
      payload = { ...baseRow };
      continue;
    }

    if (isMissingPgColumn(error, "codigo")) {
      delete baseRow.codigo;
      selectCols = "id, nome";
      payload = withTenant && tenantId ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    const missing = PARCEIRO_INSERT_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete baseRow[missing];
      payload = withTenant && tenantId ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    if (isMissingTable(error, "hub_parceiros")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_parceiros nao existe no Supabase. Execute as migracoes base de parceiros.",
          code: "PGRST205",
        },
      };
    }

    return {
      data: null,
      error: {
        message: String(error.message || "Falha ao gravar hub_parceiros."),
        code: error.code,
      },
    };
  }

  return {
    data: null,
    error: {
      message: lastError?.message || "Falha ao gravar hub_parceiros.",
      code: lastError?.code,
    },
  };
}

async function insertOptionalCompat(
  supabase: SupabaseClient,
  table: "hub_parceiros_captacao" | "hub_parceiros_log",
  row: Record<string, unknown>,
  optionalColumns: readonly string[]
): Promise<string | null> {
  const baseRow = { ...row };
  let payload = { ...baseRow };

  for (let attempt = 0; attempt < optionalColumns.length + 3; attempt++) {
    const { error } = await supabase.from(table).insert(payload);
    if (!error) return null;

    const missing = optionalColumns.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete baseRow[missing];
      payload = { ...baseRow };
      continue;
    }

    if (isMissingTable(error, table)) {
      return `${table} indisponível no schema atual.`;
    }

    if (isMissingPgColumn(error)) {
      return `${table} com schema incompatível: ${error.message}`;
    }

    return `${table}: ${error.message}`;
  }

  return `${table} não pôde ser gravada.`;
}

export async function insertParceiroCaptacaoCompat(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<string | null> {
  return insertOptionalCompat(
    supabase,
    "hub_parceiros_captacao",
    row,
    PARCEIRO_CAPTACAO_OPTIONAL_COLUMNS
  );
}

export async function insertParceiroLogCompat(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<string | null> {
  return insertOptionalCompat(supabase, "hub_parceiros_log", row, PARCEIRO_LOG_OPTIONAL_COLUMNS);
}
