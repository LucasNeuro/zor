import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  enriquecerPessoaDaDb,
  HUB_PESSOA_SELECT_CORE,
  type HubPessoaRow,
} from "@/lib/crm/hub-pessoas-compat";
import { isMissingPgColumn, isTenantFkError } from "@/lib/tenant-default";

const HUB_PESSOA_OPTIONAL_INSERT_COLUMNS = [
  "tenant_id",
  "area_atuacao",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "dados_extras",
] as const;

const EMPRESA_INSERT_SELECT = "id";
const EMPRESA_OPTIONAL_COLUMNS = [
  "tenant_id",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "nome_fantasia",
  "segmento",
] as const;

export async function insertHubPessoaCrm(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
): Promise<{ data: HubPessoaRow | null; error: unknown }> {
  const baseRow = { ...row };
  let withTenant = false;
  let payload: Record<string, unknown> = { ...baseRow };

  if (tenantId) {
    withTenant = true;
    payload = { ...baseRow, tenant_id: tenantId };
  }

  for (let attempt = 0; attempt < HUB_PESSOA_OPTIONAL_INSERT_COLUMNS.length + 5; attempt++) {
    const { data, error } = await supabase
      .from("hub_pessoas")
      .insert(payload)
      .select(HUB_PESSOA_SELECT_CORE)
      .single();

    if (!error && data) {
      return { data: enriquecerPessoaDaDb(data as Record<string, unknown>), error: null };
    }

    if (isTenantFkError(error)) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    if (isMissingPgColumn(error, "tenant_id")) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = HUB_PESSOA_OPTIONAL_INSERT_COLUMNS.find((col) =>
      isMissingPgColumn(error, col)
    );
    if (missing) {
      delete (baseRow as Record<string, unknown>)[missing];
      payload = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: "Falha ao gravar hub_pessoas." } };
}

export async function insertHubEmpresaCrm(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
): Promise<{ data: { id: string } | null; error: unknown }> {
  let payload: Record<string, unknown> = { ...row, tenant_id: tenantId };
  const baseRow = { ...row };

  for (let attempt = 0; attempt < EMPRESA_OPTIONAL_COLUMNS.length + 3; attempt++) {
    const { data, error } = await supabase
      .from("hub_empresas")
      .insert(payload)
      .select(EMPRESA_INSERT_SELECT)
      .single();

    if (!error && data?.id) return { data: { id: String(data.id) }, error: null };

    if (isMissingPgColumn(error, "tenant_id")) {
      delete (payload as Record<string, unknown>).tenant_id;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = EMPRESA_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (payload as Record<string, unknown>)[missing];
      delete (baseRow as Record<string, unknown>)[missing];
      payload =
        missing === "tenant_id" ? { ...baseRow } : { ...baseRow, tenant_id: tenantId };
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: { message: "Falha ao gravar hub_empresas." } };
}

export function crmSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function crmSupabaseConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}
