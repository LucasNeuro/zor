import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ferramentaIntegradorParaMistral,
  HUB_INTEGRADORES_CATALOGO,
  type FerramentaIntegradorMistralDef,
  type HubIntegradorId,
} from "@/lib/hub/integradores-catalogo";

function integracaoConfigurada(
  integracaoId: HubIntegradorId,
  row: {
    integracao_id: string;
    ativo?: boolean;
    config?: unknown;
    hub_integracao_credenciais?: unknown;
  }
): boolean {
  if (row.ativo === false || row.integracao_id !== integracaoId) return false;
  const creds = row.hub_integracao_credenciais;
  const credRow = Array.isArray(creds) ? creds[0] : creds;
  const credObj =
    credRow &&
    typeof credRow === "object" &&
    "credenciais" in (credRow as object) &&
    (credRow as { credenciais?: unknown }).credenciais &&
    typeof (credRow as { credenciais: unknown }).credenciais === "object"
      ? ((credRow as { credenciais: Record<string, unknown> }).credenciais as Record<string, unknown>)
      : {};

  if (integracaoId === "zendesk") {
    const cfg =
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {};
    const sub = typeof cfg.subdomain === "string" ? cfg.subdomain.trim() : "";
    const key = typeof credObj.api_key === "string" ? credObj.api_key.trim() : "";
    return Boolean(sub && key);
  }

  const bearer = typeof credObj.bearer_token === "string" ? credObj.bearer_token.trim() : "";
  return Boolean(bearer);
}

/** Ferramentas hub_int_* disponíveis para Mistral (integradores ligados no tenant). */
export async function ferramentasIntegradorAtivasParaTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FerramentaIntegradorMistralDef[]> {
  const { data, error } = await supabase
    .from("hub_integracoes")
    .select("integracao_id, ativo, config, hub_integracao_credenciais(credenciais)")
    .eq("tenant_id", tenantId)
    .eq("ativo", true);

  if (error || !data?.length) return [];

  const out: FerramentaIntegradorMistralDef[] = [];
  for (const entry of HUB_INTEGRADORES_CATALOGO) {
    const row = data.find((r) => r.integracao_id === entry.id);
    if (!row || !integracaoConfigurada(entry.id, row)) continue;
    for (const f of entry.ferramentas) {
      out.push(ferramentaIntegradorParaMistral(entry.id, f));
    }
  }
  return out;
}
