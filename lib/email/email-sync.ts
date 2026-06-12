import type { SupabaseClient } from "@supabase/supabase-js";
import { processOAuthInboundEmail } from "@/lib/email/inbound-processor";
import { getValidGoogleAccessToken, readStoredGoogleOAuthCredentials } from "@/lib/email/oauth-google";
import type { HubIntegracaoCredenciaisRow } from "@/lib/hub/ferramentas-externas-db";
import {
  fetchGmailMessageAsInbound,
  fetchGmailProfile,
  listGmailUnreadMessages,
  markGmailMessageRead,
} from "@/lib/email/gmail-inbox";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";
import { resolverAgenteParaInboundOAuth } from "@/lib/email/resolve-agente-por-email";
import { resolveEmailProviderForAgente } from "@/lib/email/resolve-email-provider";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type EmailSyncMessageResult = {
  gmail_message_id: string;
  status: "processed" | "ignored" | "duplicate" | "error";
  reason?: string;
  agente_slug?: string;
  lead_id?: string;
};

export type EmailSyncIntegracaoResult = {
  integracao_id: string;
  tenant_id: string;
  mailbox?: string;
  listed: number;
  results: EmailSyncMessageResult[];
  error?: string;
};

export type EmailSyncTickResult = {
  integracoes: number;
  processed: number;
  ignored: number;
  duplicate: number;
  errors: number;
  details: EmailSyncIntegracaoResult[];
  error?: string;
};

function configEmail(integracao: { config?: unknown }): string | null {
  if (!integracao.config || typeof integracao.config !== "object" || Array.isArray(integracao.config)) {
    return null;
  }
  const cfg = integracao.config as Record<string, unknown>;
  const oauthEmail = typeof cfg.oauth_email === "string" ? cfg.oauth_email : null;
  const legacyEmail = typeof cfg.email === "string" ? cfg.email : null;
  return normalizarEnderecoEmail(oauthEmail || legacyEmail);
}

async function gmailMessageJaSincronizado(
  supabase: SupabaseClient,
  integracaoRowId: string,
  gmailMessageId: string
): Promise<boolean> {
  const id = gmailMessageId.trim();
  if (!id) return false;

  const { data, error } = await supabase
    .from("hub_email_sync_state")
    .select("id")
    .eq("integracao_id", integracaoRowId)
    .eq("gmail_message_id", id)
    .limit(1);

  if (error) {
    if (isMissingPgColumn(error, "hub_email_sync_state")) return false;
    console.warn("[email-sync] dedupe state:", error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/** Sincroniza inbox Gmail de uma integração tenant (OAuth bearer). */
export async function syncGmailIntegracaoInbox(
  supabase: SupabaseClient,
  pack: {
    integracao: { id: string; tenant_id: string; config?: unknown };
    credenciais: HubIntegracaoCredenciaisRow | null;
  }
): Promise<EmailSyncIntegracaoResult> {
  const integracaoId = String(pack.integracao.id);
  const tenantId = String(pack.integracao.tenant_id);
  const result: EmailSyncIntegracaoResult = {
    integracao_id: integracaoId,
    tenant_id: tenantId,
    listed: 0,
    results: [],
  };

  const token = await getValidGoogleAccessToken(
    supabase,
    tenantId,
    pack.credenciais,
    integracaoId
  );
  if (!token) {
    result.error = "gmail_sem_token";
    return result;
  }

  let mailbox = configEmail(pack.integracao);
  if (!mailbox) {
    const stored = readStoredGoogleOAuthCredentials(pack.credenciais);
    mailbox = stored?.email ? normalizarEnderecoEmail(stored.email) : null;
  }
  if (!mailbox) {
    const profile = await fetchGmailProfile(token);
    if (profile.ok) mailbox = profile.emailAddress;
  }
  result.mailbox = mailbox ?? undefined;

  const listed = await listGmailUnreadMessages(token, { maxResults: 25 });
  if (!listed.ok) {
    result.error = listed.error;
    return result;
  }

  result.listed = listed.messages.length;

  for (const item of listed.messages) {
    const msgId = item.id;
    if (await gmailMessageJaSincronizado(supabase, integracaoId, msgId)) {
      result.results.push({ gmail_message_id: msgId, status: "duplicate", reason: "sync_state" });
      continue;
    }

    const fetched = await fetchGmailMessageAsInbound(token, msgId, item.threadId);
    if (!fetched.ok) {
      result.results.push({ gmail_message_id: msgId, status: "error", reason: fetched.error });
      continue;
    }

    const inbound = fetched.inbound;

    if (mailbox && inbound.fromEmail === mailbox) {
      result.results.push({ gmail_message_id: msgId, status: "ignored", reason: "self_sent" });
      await markGmailMessageRead(token, msgId);
      continue;
    }

    const match = await resolverAgenteParaInboundOAuth(supabase, inbound.toAddresses, integracaoId);
    if (!match) {
      result.results.push({ gmail_message_id: msgId, status: "ignored", reason: "agent_not_found" });
      continue;
    }

    const provider = resolveEmailProviderForAgente(match.agente);
    if (provider !== "oauth_google") {
      result.results.push({
        gmail_message_id: msgId,
        status: "ignored",
        reason: "agent_not_oauth_google",
        agente_slug: match.agente.agente_slug,
      });
      continue;
    }

    const processed = await processOAuthInboundEmail(supabase, inbound, {
      agente: match.agente,
      integracaoRowId: integracaoId,
      bearerToken: token,
      mailboxEmail: mailbox,
    });

    if (!processed.ok) {
      result.results.push({
        gmail_message_id: msgId,
        status: "error",
        reason: processed.error,
        agente_slug: match.agente.agente_slug,
      });
      continue;
    }

    if (processed.status === "duplicate") {
      result.results.push({
        gmail_message_id: msgId,
        status: "duplicate",
        reason: processed.reason,
        agente_slug: processed.agente_slug,
      });
    } else if (processed.status === "ignored") {
      result.results.push({
        gmail_message_id: msgId,
        status: "ignored",
        reason: processed.reason,
        agente_slug: processed.agente_slug,
      });
    } else {
      result.results.push({
        gmail_message_id: msgId,
        status: "processed",
        agente_slug: processed.agente_slug,
        lead_id: processed.lead_id,
      });
      await markGmailMessageRead(token, msgId);
    }
  }

  return result;
}

/** Tick do cron: percorre integrações Gmail activas de todos os tenants. */
export async function runEmailSyncTick(supabase: SupabaseClient): Promise<EmailSyncTickResult> {
  const summary: EmailSyncTickResult = {
    integracoes: 0,
    processed: 0,
    ignored: 0,
    duplicate: 0,
    errors: 0,
    details: [],
  };

  const { data: integracoes, error } = await supabase
    .from("hub_integracoes")
    .select("id, tenant_id, integracao_id, config, ativo, hub_integracao_credenciais(credenciais)")
    .eq("integracao_id", "gmail")
    .eq("ativo", true);

  if (error) {
    summary.error = error.message;
    return summary;
  }

  const rows = integracoes ?? [];
  summary.integracoes = rows.length;

  for (const row of rows) {
    const credsRaw = (row as { hub_integracao_credenciais?: unknown }).hub_integracao_credenciais;
    const credRow = Array.isArray(credsRaw) ? credsRaw[0] : credsRaw;

    const detail = await syncGmailIntegracaoInbox(supabase, {
      integracao: {
        id: String(row.id),
        tenant_id: String(row.tenant_id),
        config: row.config,
      },
      credenciais:
        credRow && typeof credRow === "object"
          ? ({
              ...(credRow as HubIntegracaoCredenciaisRow),
              credenciais:
                (credRow as HubIntegracaoCredenciaisRow).credenciais ??
                (credRow as { credenciais?: Record<string, unknown> }).credenciais ??
                {},
            } as HubIntegracaoCredenciaisRow)
          : null,
    });

    summary.details.push(detail);

    if (detail.error) {
      summary.errors += 1;
      continue;
    }

    for (const r of detail.results) {
      if (r.status === "processed") summary.processed += 1;
      else if (r.status === "ignored") summary.ignored += 1;
      else if (r.status === "duplicate") summary.duplicate += 1;
      else if (r.status === "error") summary.errors += 1;
    }
  }

  return summary;
}
