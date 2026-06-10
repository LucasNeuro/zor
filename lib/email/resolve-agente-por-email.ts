import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";
import { defaultTenantId } from "@/lib/tenant-default";

export type AgenteEmailRow = {
  agente_slug: string;
  nome?: string | null;
  modo_operacao?: string | null;
  email_from?: string | null;
  email_from_name?: string | null;
  email_inbound?: string | null;
  email_ativo?: boolean | null;
  tenant_id?: string | null;
  ativo?: boolean | null;
  arquivado_em?: string | null;
};

const AGENTE_EMAIL_SELECT =
  "agente_slug, nome, modo_operacao, email_from, email_from_name, email_inbound, email_ativo, tenant_id, ativo, arquivado_em";

/** Resolve agente canal e-mail pelo endereço inbound (case-insensitive). */
export async function resolverAgentePorEmailInbound(
  supabase: SupabaseClient,
  inboundAddress: string
): Promise<AgenteEmailRow | null> {
  const addr = normalizarEnderecoEmail(inboundAddress);
  if (!addr) return null;

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(AGENTE_EMAIL_SELECT)
    .ilike("email_inbound", addr)
    .maybeSingle();

  if (error) {
    console.error("[email] resolverAgentePorEmailInbound:", error.message);
    return null;
  }

  if (!data) return null;

  const row = data as AgenteEmailRow;
  if (row.arquivado_em != null) return null;
  if (row.email_ativo === false) return null;
  if (row.ativo === false) return null;
  if (row.modo_operacao !== "canal_email") return null;

  const tid = defaultTenantId();
  const agentTenant = typeof row.tenant_id === "string" ? row.tenant_id.trim() : "";
  if (agentTenant && agentTenant !== tid) return null;

  return row;
}

/** Primeiro endereço `to` que corresponde a um agente ativo. */
export async function resolverAgentePorDestinatariosInbound(
  supabase: SupabaseClient,
  toAddresses: string[]
): Promise<{ agente: AgenteEmailRow; matchedAddress: string } | null> {
  for (const raw of toAddresses) {
    const agente = await resolverAgentePorEmailInbound(supabase, raw);
    const addr = normalizarEnderecoEmail(raw);
    if (agente && addr) {
      return { agente, matchedAddress: addr };
    }
  }
  return null;
}
