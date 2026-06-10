import { resendFetchJson } from "@/lib/email/resend-http";

export type ResendReceivedEmail = {
  id: string;
  from: string | null;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
};

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickAddresses(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return [v.trim()];
    if (Array.isArray(v)) {
      return v.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizarRecebido(data: Record<string, unknown>): ResendReceivedEmail | null {
  const id = pickStr(data, ["id", "email_id"]);
  if (!id) return null;

  const headers =
    data.headers && typeof data.headers === "object" && !Array.isArray(data.headers)
      ? (data.headers as Record<string, unknown>)
      : {};

  const text = pickStr(data, ["text", "plain", "body_text"]) || null;
  const htmlRaw = pickStr(data, ["html", "body_html"]);
  const html = htmlRaw || null;

  return {
    id,
    from: pickStr(data, ["from"]) || null,
    to: pickAddresses(data, ["to", "recipients"]),
    subject: pickStr(data, ["subject"]) || null,
    text,
    html,
    messageId: pickStr(data, ["message_id", "messageId"]) || null,
    inReplyTo:
      pickStr(headers, ["in-reply-to", "In-Reply-To"]) ||
      pickStr(data, ["in_reply_to", "inReplyTo"]) ||
      null,
    references:
      pickStr(headers, ["references", "References"]) || pickStr(data, ["references"]) || null,
  };
}

export type FetchResendReceivedEmailResult =
  | { ok: true; email: ResendReceivedEmail }
  | { ok: false; error: string; status?: number };

/** Obtém corpo e metadados de e-mail recebido (webhook Resend só envia metadados). */
export async function fetchResendReceivedEmail(emailId: string): Promise<FetchResendReceivedEmailResult> {
  const id = emailId.trim();
  if (!id) {
    return { ok: false, error: "email_id obrigatório" };
  }

  const out = await resendFetchJson<Record<string, unknown>>(`/emails/receiving/${encodeURIComponent(id)}`);
  if (!out.ok) {
    return { ok: false, error: out.error, status: out.status };
  }

  const raw = out.data;
  const data =
    raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : (raw as Record<string, unknown>);

  const email = normalizarRecebido(data);
  if (!email) {
    return { ok: false, error: "Resposta Resend sem dados de e-mail recebido" };
  }

  return { ok: true, email };
}
