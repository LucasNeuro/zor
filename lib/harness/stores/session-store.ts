import type { SupabaseClient } from "@supabase/supabase-js";
import type { HarnessModeId, HarnessSurface } from "@/lib/harness/types";
import { HARNESS_VERSION } from "@/lib/harness/types";

export type HarnessSessionRow = {
  id: string;
  modo_id: HarnessModeId;
  grants: Record<string, boolean>;
  pending_approvals: unknown[];
};

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("hub_harness_sessions") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function getOrCreateHarnessSession(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    surface: HarnessSurface | "whatsapp_lead" | "email_lead";
    resourceId?: string | null;
    leadId?: string | null;
    modoId?: HarnessModeId;
  }
): Promise<HarnessSessionRow | null> {
  const resourceId = params.resourceId?.trim() || null;
  const leadId = params.leadId?.trim() || null;

  let query = supabase
    .from("hub_harness_sessions")
    .select("id, modo_id, grants, pending_approvals")
    .eq("tenant_id", params.tenantId)
    .eq("agente_slug", params.agenteSlug)
    .eq("surface", params.surface);

  if (resourceId) query = query.eq("resource_id", resourceId);
  else query = query.is("resource_id", null);

  if (leadId) query = query.eq("lead_id", leadId);
  else query = query.is("lead_id", null);

  const { data: existente, error: errSel } = await query.maybeSingle();
  if (errSel && !tabelaInexistente(errSel.message)) return null;
  if (existente?.id) {
    return {
      id: existente.id as string,
      modo_id: (existente.modo_id as HarnessModeId) ?? "operar",
      grants: (existente.grants as Record<string, boolean>) ?? {},
      pending_approvals: (existente.pending_approvals as unknown[]) ?? [],
    };
  }

  const { data: criada, error: errIns } = await supabase
    .from("hub_harness_sessions")
    .insert({
      tenant_id: params.tenantId,
      agente_slug: params.agenteSlug,
      surface: params.surface,
      resource_id: resourceId,
      lead_id: leadId,
      modo_id: params.modoId ?? "operar",
      harness_version: HARNESS_VERSION,
      grants: { crm_leitura: true },
    })
    .select("id, modo_id, grants, pending_approvals")
    .maybeSingle();

  if (errIns || !criada) return null;
  return {
    id: criada.id as string,
    modo_id: (criada.modo_id as HarnessModeId) ?? "operar",
    grants: (criada.grants as Record<string, boolean>) ?? {},
    pending_approvals: (criada.pending_approvals as unknown[]) ?? [],
  };
}

export function modoBloqueiaEscritaCrm(modoId: HarnessModeId): boolean {
  return modoId === "conversar" || modoId === "analisar";
}

export function grantPermiteEscritaCrm(grants: Record<string, boolean>): boolean {
  return grants.crm_escrita_sessao === true || grants.crm_escrita === true;
}
