import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidGoogleAccessToken } from "@/lib/email/oauth-google";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import { sendEmail } from "@/lib/email/resend-send";
import { resendConfigured } from "@/lib/email/resend-config";
import {
  emailProviderAvailable,
  resolveEmailProviderForAgente,
  type EmailProviderMode,
} from "@/lib/email/resolve-email-provider";
import type { AgenteEmailRow } from "@/lib/email/resolve-agente-por-email";

export type SendViaAgenteInput = {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
  threadId?: string | null;
  replyTo?: string | null;
};

export type SendViaAgenteResult =
  | { ok: true; provider: EmailProviderMode; id?: string; threadId?: string }
  | { ok: false; error: string; provider?: EmailProviderMode; status?: number; body?: unknown };

type AgenteSendFields = Pick<
  AgenteEmailRow,
  | "email_from"
  | "email_from_name"
  | "email_inbound"
  | "email_provider"
  | "email_integracao_id"
>;

/** Envia e-mail pelo provider configurado no agente (Gmail OAuth ou Resend). */
export async function sendEmailViaAgente(
  supabase: SupabaseClient,
  tenantId: string,
  agente: AgenteSendFields,
  input: SendViaAgenteInput,
  opts?: { origin?: string; mailboxEmail?: string | null }
): Promise<SendViaAgenteResult> {
  const provider = resolveEmailProviderForAgente(agente);

  if (!emailProviderAvailable(provider, opts?.origin)) {
    return {
      ok: false,
      provider,
      error:
        provider === "oauth_google"
          ? "Gmail OAuth não configurado para este tenant."
          : "Resend não configurado: defina RESEND_API_KEY",
      status: 503,
    };
  }

  const from =
    agente.email_from?.trim() ||
    opts?.mailboxEmail?.trim() ||
    agente.email_inbound?.trim() ||
    null;
  const fromName = agente.email_from_name?.trim() || null;

  if (provider === "oauth_google") {
    const integracaoId =
      typeof agente.email_integracao_id === "string" ? agente.email_integracao_id.trim() : "";
    if (!integracaoId) {
      return { ok: false, provider, error: "Agente OAuth sem email_integracao_id.", status: 409 };
    }

    const { data: credRow } = await supabase
      .from("hub_integracao_credenciais")
      .select("*")
      .eq("integracao_id", integracaoId)
      .maybeSingle();

    const token = await getValidGoogleAccessToken(supabase, tenantId, credRow, integracaoId);
    if (!token) {
      return {
        ok: false,
        provider,
        error: "Token Gmail indisponível. Volte a ligar a conta Google.",
        status: 409,
      };
    }

    const gmail = await sendGmailEmail({
      bearerToken: token,
      to: input.to,
      subject: input.subject,
      text: input.text,
      from,
      fromName,
      inReplyTo: input.inReplyTo,
      references: input.references,
      threadId: input.threadId,
    });

    if (!gmail.ok) {
      return { ok: false, provider, error: gmail.error, status: gmail.status };
    }

    return { ok: true, provider, id: gmail.id, threadId: gmail.threadId };
  }

  if (!resendConfigured()) {
    return { ok: false, provider, error: "Resend não configurado: defina RESEND_API_KEY", status: 503 };
  }

  const resend = await sendEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    from,
    fromName,
    inReplyTo: input.inReplyTo,
    references: input.references,
    replyTo: input.replyTo || undefined,
  });

  if (!resend.ok) {
    return { ok: false, provider, error: resend.error, status: resend.status, body: resend.body };
  }

  return { ok: true, provider, id: resend.id };
}
