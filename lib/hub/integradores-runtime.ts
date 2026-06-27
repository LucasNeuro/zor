import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ferramentaIntegradorParaMistral,
  HUB_INTEGRADORES_CATALOGO,
  type FerramentaIntegradorMistralDef,
  type HubIntegradorId,
} from "@/lib/hub/integradores-catalogo";
import { mem0PlataformaConfigurada } from "@/lib/hub/mem0-env";

function credenciaisObj(credRow: unknown): Record<string, unknown> {
  const credObj =
    credRow &&
    typeof credRow === "object" &&
    "credenciais" in (credRow as object) &&
    (credRow as { credenciais?: unknown }).credenciais &&
    typeof (credRow as { credenciais: unknown }).credenciais === "object" &&
    !Array.isArray((credRow as { credenciais: unknown }).credenciais)
      ? ((credRow as { credenciais: Record<string, unknown> }).credenciais as Record<string, unknown>)
      : {};
  return credObj;
}

/** OAuth Google guarda access_token encriptado (_enc), não bearer_token legado. */
function credenciaisIntegradorProntas(
  integracaoId: HubIntegradorId,
  credObj: Record<string, unknown>
): boolean {
  if (integracaoId === "google_calendar" || integracaoId === "gmail") {
    if (credObj._enc === true && typeof credObj.access_token === "string" && credObj.access_token.trim()) {
      return true;
    }
  }
  const bearer = typeof credObj.bearer_token === "string" ? credObj.bearer_token.trim() : "";
  return Boolean(bearer);
}

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
  const credObj = credenciaisObj(credRow);

  if (integracaoId === "zendesk") {
    const cfg =
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {};
    const sub = typeof cfg.subdomain === "string" ? cfg.subdomain.trim() : "";
    const key = typeof credObj.api_key === "string" ? credObj.api_key.trim() : "";
    return Boolean(sub && key);
  }

  if (integracaoId === "mem0") {
    return mem0PlataformaConfigurada();
  }

  return credenciaisIntegradorProntas(integracaoId, credObj);
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

  const rows = data ?? [];

  const out: FerramentaIntegradorMistralDef[] = [];
  for (const entry of HUB_INTEGRADORES_CATALOGO) {
    if (entry.id === "mem0") {
      if (!mem0PlataformaConfigurada()) continue;
      for (const f of entry.ferramentas) {
        if (f.exportarMistral === false) continue;
        out.push(ferramentaIntegradorParaMistral(entry.id, f));
      }
      continue;
    }
    const row = rows.find((r) => r.integracao_id === entry.id);
    if (!row || !integracaoConfigurada(entry.id, row)) continue;
    for (const f of entry.ferramentas) {
      out.push(ferramentaIntegradorParaMistral(entry.id, f));
    }
  }
  return out;
}
