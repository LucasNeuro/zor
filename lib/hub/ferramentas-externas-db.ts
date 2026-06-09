import type { SupabaseClient } from "@supabase/supabase-js";

export type HubIntegracaoTipo =
  | "webhook_generico"
  | "google_calendar"
  | "gmail"
  | "zendesk";

export type HubIntegracaoStatus = "ativo" | "em_breve" | "erro" | "pendente_configuracao";

export type HubIntegracaoAuthTipo = "api_key" | "bearer" | "oauth_placeholder";

export type HubFerramentaExternaPolitica = "leitura" | "escrita";

export type HubIntegracaoRow = {
  id: string;
  tenant_id: string;
  integracao_id: HubIntegracaoTipo;
  nome: string;
  status: HubIntegracaoStatus;
  config: Record<string, unknown>;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type HubIntegracaoCredenciaisRow = {
  id: string;
  tenant_id: string;
  integracao_id: string;
  tipo_auth: HubIntegracaoAuthTipo;
  credenciais: Record<string, unknown>;
  atualizado_em?: string;
};

export type HubFerramentaExternaRow = {
  id: string;
  tenant_id: string;
  ferramenta_key: string;
  titulo: string;
  descricao_curta?: string | null;
  descricao_modelo: string;
  integracao_id: string;
  metodo_http: string;
  url_template: string;
  headers_template: Record<string, unknown>;
  body_template?: string | null;
  parametros_schema: unknown;
  politica: HubFerramentaExternaPolitica;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type FerramentaExternaParaMistral = {
  ferramenta_key: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
};

export const HUB_INTEGRACAO_TIPOS: readonly HubIntegracaoTipo[] = [
  "webhook_generico",
  "google_calendar",
  "gmail",
  "zendesk",
] as const;

/** Tipos ainda sem runtime completo (ficam status em_breve no POST legado). */
export const HUB_INTEGRACAO_TIPOS_EM_BREVE: readonly HubIntegracaoTipo[] = [] as const;

export function integracaoTipoValido(v: string): v is HubIntegracaoTipo {
  return (HUB_INTEGRACAO_TIPOS as readonly string[]).includes(v);
}

export function integracaoStatusValido(v: string): v is HubIntegracaoStatus {
  return v === "ativo" || v === "em_breve" || v === "erro" || v === "pendente_configuracao";
}

export function integracaoAuthTipoValido(v: string): v is HubIntegracaoAuthTipo {
  return v === "api_key" || v === "bearer" || v === "oauth_placeholder";
}

export function ferramentaExternaPoliticaValida(v: string): v is HubFerramentaExternaPolitica {
  return v === "leitura" || v === "escrita";
}

export function metodoHttpValido(v: string): boolean {
  return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(v.toUpperCase());
}

export function rowParaMistralDefExterna(row: HubFerramentaExternaRow): FerramentaExternaParaMistral {
  const schema =
    row.parametros_schema && typeof row.parametros_schema === "object" && !Array.isArray(row.parametros_schema)
      ? (row.parametros_schema as Record<string, unknown>)
      : { type: "object", properties: {}, additionalProperties: false };
  return {
    ferramenta_key: row.ferramenta_key,
    descricao_modelo: row.descricao_modelo,
    parametros_schema: schema,
  };
}

export async function fetchFerramentasExternasAtivas(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HubFerramentaExternaRow[]> {
  const { data, error } = await supabase
    .from("hub_ferramentas_externas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as HubFerramentaExternaRow[];
}

export async function fetchFerramentaExternaPorKey(
  supabase: SupabaseClient,
  tenantId: string,
  ferramentaKey: string
): Promise<HubFerramentaExternaRow | null> {
  const { data, error } = await supabase
    .from("hub_ferramentas_externas")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ferramenta_key", ferramentaKey)
    .eq("ativo", true)
    .maybeSingle();
  if (error) return null;
  return data as HubFerramentaExternaRow | null;
}

export async function fetchIntegracaoComCredenciais(
  supabase: SupabaseClient,
  tenantId: string,
  integracaoRowId: string
): Promise<{ integracao: HubIntegracaoRow; credenciais: HubIntegracaoCredenciaisRow | null } | null> {
  const { data: integracao, error: e1 } = await supabase
    .from("hub_integracoes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", integracaoRowId)
    .eq("ativo", true)
    .maybeSingle();
  if (e1 || !integracao) return null;

  const { data: credenciais } = await supabase
    .from("hub_integracao_credenciais")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integracaoRowId)
    .maybeSingle();

  return {
    integracao: integracao as HubIntegracaoRow,
    credenciais: (credenciais as HubIntegracaoCredenciaisRow | null) ?? null,
  };
}

export function slugifyFerramentaExternaSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return s;
}

export function ferramentaKeyAPartirDeSlugCurto(slugCurto: string): string {
  const s = slugifyFerramentaExternaSlug(slugCurto);
  if (s.length < 2) return "";
  return `hub_ext_${s}`;
}
