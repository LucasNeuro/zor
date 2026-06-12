import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEmailProviderForAgente } from "@/lib/email/resolve-email-provider";
import { readStoredGoogleOAuthCredentials } from "@/lib/email/oauth-google";
import type { HubIntegracaoCredenciaisRow } from "@/lib/hub/ferramentas-externas-db";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type EmailOAuthStatusPayload = {
  oauth_connected: boolean;
  oauth_provider: "google" | null;
  oauth_email: string | null;
  oauth_display_name: string | null;
  oauth_connected_at: string | null;
  oauth_last_sync_at: string | null;
  email_mode: "oauth" | "resend";
  email_provider: string | null;
  email_integracao_id: string | null;
};

function oauthEmailFromIntegracaoConfig(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const o = config as Record<string, unknown>;
  const email = o.oauth_email ?? o.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

/** Estado OAuth Gmail do agente (para GET /email e GET /email/oauth). */
export async function carregarEmailOAuthStatus(
  supabase: SupabaseClient,
  agente: Record<string, unknown>
): Promise<EmailOAuthStatusPayload> {
  const provider = resolveEmailProviderForAgente({
    email_provider:
      typeof agente.email_provider === "string" ? agente.email_provider : null,
    email_integracao_id:
      typeof agente.email_integracao_id === "string" ? agente.email_integracao_id : null,
  });

  const integracaoId =
    typeof agente.email_integracao_id === "string" ? agente.email_integracao_id.trim() : "";

  if (provider !== "oauth_google" || !integracaoId) {
    return {
      oauth_connected: false,
      oauth_provider: null,
      oauth_email: null,
      oauth_display_name: null,
      oauth_connected_at: null,
      oauth_last_sync_at: null,
      email_mode: "resend",
      email_provider: typeof agente.email_provider === "string" ? agente.email_provider : "resend",
      email_integracao_id: integracaoId || null,
    };
  }

  const tenantId = typeof agente.tenant_id === "string" ? agente.tenant_id.trim() : "";

  const { data: integracao } = await supabase
    .from("hub_integracoes")
    .select("id, config, atualizado_em")
    .eq("id", integracaoId)
    .maybeSingle();

  const { data: credRow } = await supabase
    .from("hub_integracao_credenciais")
    .select("credenciais, atualizado_em, tipo_auth")
    .eq("integracao_id", integracaoId)
    .maybeSingle();

  const stored = readStoredGoogleOAuthCredentials(
    (credRow as HubIntegracaoCredenciaisRow | null) ?? null
  );

  const oauthEmail =
    stored?.email ||
    oauthEmailFromIntegracaoConfig(integracao?.config) ||
    (typeof agente.email_from === "string" ? agente.email_from.trim().toLowerCase() : null) ||
    null;

  const connectedAt =
    (typeof credRow?.atualizado_em === "string" && credRow.atualizado_em) ||
    (typeof integracao?.atualizado_em === "string" && integracao.atualizado_em) ||
    (typeof agente.email_configured_at === "string" ? agente.email_configured_at : null);

  let lastSyncAt: string | null = null;
  const { data: syncRows, error: syncErr } = await supabase
    .from("hub_email_sync_state")
    .select("processado_em")
    .eq("integracao_id", integracaoId)
    .order("processado_em", { ascending: false })
    .limit(1);

  if (!syncErr && syncRows?.[0] && typeof syncRows[0].processado_em === "string") {
    lastSyncAt = syncRows[0].processado_em;
  } else if (syncErr && !isMissingPgColumn(syncErr, "hub_email_sync_state")) {
    console.warn("[email/oauth-status] sync state:", syncErr.message);
  }

  const displayName =
    typeof agente.email_from_name === "string" && agente.email_from_name.trim()
      ? agente.email_from_name.trim()
      : null;

  const hasToken = Boolean(stored?.accessToken || stored?.refreshToken);

  return {
    oauth_connected: Boolean(oauthEmail && hasToken),
    oauth_provider: oauthEmail && hasToken ? "google" : null,
    oauth_email: oauthEmail,
    oauth_display_name: displayName,
    oauth_connected_at: connectedAt,
    oauth_last_sync_at: lastSyncAt,
    email_mode: "oauth",
    email_provider: "oauth_google",
    email_integracao_id: integracaoId,
  };
}
