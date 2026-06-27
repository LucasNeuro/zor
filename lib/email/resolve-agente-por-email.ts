import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";

export type AgenteEmailRow = {
  agente_slug: string;
  nome?: string | null;
  modo_operacao?: string | null;
  email_from?: string | null;
  email_from_name?: string | null;
  email_inbound?: string | null;
  email_ativo?: boolean | null;
  email_provider?: string | null;
  email_integracao_id?: string | null;
  tenant_id?: string | null;
  ativo?: boolean | null;
  arquivado_em?: string | null;
};

const AGENTE_EMAIL_SELECT =
  "agente_slug, nome, modo_operacao, email_from, email_from_name, email_inbound, email_ativo, email_provider, email_integracao_id, tenant_id, ativo, arquivado_em";

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

function agenteEmailAtivo(row: AgenteEmailRow): boolean {
  if (row.arquivado_em != null) return false;
  if (row.email_ativo === false) return false;
  if (row.ativo === false) return false;
  if (row.modo_operacao !== "canal_email") return false;
  return true;
}

function agenteTenantPermitido(row: AgenteEmailRow): boolean {
  const tid = defaultTenantId();
  const agentTenant = typeof row.tenant_id === "string" ? row.tenant_id.trim() : "";
  if (agentTenant && agentTenant !== tid) return false;
  return true;
}

function escolherAgenteOAuthPreferido(
  rows: AgenteEmailRow[],
  opts?: { inboundHint?: string | null }
): AgenteEmailRow | null {
  const ativos = rows.filter((r) => agenteEmailAtivo(r) && agenteTenantPermitido(r));
  if (ativos.length === 0) return null;
  if (ativos.length === 1) return ativos[0]!;

  const hint = opts?.inboundHint ? normalizarEnderecoEmail(opts.inboundHint) : null;
  if (hint) {
    const byInbound = ativos.find(
      (r) => r.email_inbound && normalizarEnderecoEmail(r.email_inbound) === hint
    );
    if (byInbound) return byInbound;
  }

  return ativos.sort((a, b) => a.agente_slug.localeCompare(b.agente_slug))[0]!;
}

/** Agente(s) canal e-mail ligado(s) à integração Gmail (OAuth). */
export async function resolverAgentePorIntegracaoGmail(
  supabase: SupabaseClient,
  integracaoRowId: string,
  opts?: { inboundHint?: string | null }
): Promise<AgenteEmailRow | null> {
  const id = integracaoRowId.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(AGENTE_EMAIL_SELECT)
    .eq("email_integracao_id", id)
    .eq("email_provider", "oauth_google");

  if (error) {
    if (isMissingPgColumn(error, "email_integracao_id") || isMissingPgColumn(error, "email_provider")) {
      return null;
    }
    console.error("[email] resolverAgentePorIntegracaoGmail:", error.message);
    return null;
  }

  if (!data?.length) return null;
  return escolherAgenteOAuthPreferido(data as AgenteEmailRow[], opts);
}

/** Resolve agente Gmail OAuth: endereço `to` ou ligação email_integracao_id. */
export async function resolverAgenteParaInboundOAuth(
  supabase: SupabaseClient,
  toAddresses: string[],
  integracaoRowId: string
): Promise<{ agente: AgenteEmailRow; matchedAddress: string | null } | null> {
  const byTo = await resolverAgentePorDestinatariosInbound(supabase, toAddresses);
  if (byTo) {
    const provider = byTo.agente.email_provider || "oauth_google";
    if (provider === "oauth_google") {
      const link = (byTo.agente.email_integracao_id || "").trim();
      if (!link || link === integracaoRowId) {
        return { agente: byTo.agente, matchedAddress: byTo.matchedAddress };
      }
    }
  }

  const inboundHint = toAddresses.map((x) => normalizarEnderecoEmail(x)).find(Boolean) || null;
  const byIntegracao = await resolverAgentePorIntegracaoGmail(supabase, integracaoRowId, {
    inboundHint,
  });
  if (byIntegracao) {
    const addr = byIntegracao.email_inbound ? normalizarEnderecoEmail(byIntegracao.email_inbound) : null;
    return { agente: byIntegracao, matchedAddress: addr };
  }

  return null;
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
