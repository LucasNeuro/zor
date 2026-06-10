import { resendDefaultFromEmail, resendConfigured } from "@/lib/email/resend-config";
import { resendFetchJson } from "@/lib/email/resend-http";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string | null;
  fromName?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  replyTo?: string | null;
};

export type SendEmailResult =
  | { ok: true; status: number; id?: string; body?: unknown }
  | { ok: false; status?: number; error: string; body?: unknown };

function montarFromAddress(from?: string | null, fromName?: string | null): string | null {
  const email = (from || resendDefaultFromEmail() || "").trim();
  if (!email) return null;

  const name = (fromName || "").trim();
  if (!name) {
    if (email.includes("<") && email.includes(">")) return email;
    return email;
  }

  if (email.includes("<") && email.includes(">")) return email;
  return `${name} <${email.replace(/^<|>$/g, "")}>`;
}

function normalizarDestinatarios(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((x) => x.trim()).filter(Boolean);
}

/** Envia e-mail via Resend API. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resendConfigured()) {
    return { ok: false, error: "Resend não configurado: defina RESEND_API_KEY" };
  }

  const to = normalizarDestinatarios(input.to);
  if (to.length === 0) {
    return { ok: false, error: "Destinatário (to) obrigatório" };
  }

  const from = montarFromAddress(input.from, input.fromName);
  if (!from) {
    return {
      ok: false,
      error: "Remetente não configurado: defina email_from no agente ou RESEND_FROM_EMAIL",
    };
  }

  const subject = (input.subject || "").trim();
  if (!subject) {
    return { ok: false, error: "Assunto (subject) obrigatório" };
  }

  const text = (input.text || "").trim();
  const html = (input.html || "").trim();
  if (!text && !html) {
    return { ok: false, error: "Informe text ou html" };
  }

  const headers: Record<string, string> = {};
  if (input.inReplyTo?.trim()) headers["In-Reply-To"] = input.inReplyTo.trim();
  if (input.references?.trim()) headers.References = input.references.trim();

  const body: Record<string, unknown> = {
    from,
    to,
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(input.replyTo?.trim() ? { reply_to: input.replyTo.trim() } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };

  const out = await resendFetchJson<{ id?: string }>("/emails", { method: "POST", body });
  if (!out.ok) {
    return { ok: false, status: out.status, error: out.error, body: out.data };
  }

  const id = out.data && typeof out.data === "object" && "id" in out.data ? String(out.data.id || "") : undefined;
  return { ok: true, status: out.status, id: id || undefined, body: out.data };
}
