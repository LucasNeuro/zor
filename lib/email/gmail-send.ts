import { gmailFetchJson } from "@/lib/email/gmail-api";

export type SendGmailEmailInput = {
  bearerToken: string;
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  from?: string | null;
  fromName?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  threadId?: string | null;
};

export type SendGmailEmailResult =
  | { ok: true; id?: string; threadId?: string }
  | { ok: false; error: string; status?: number };

function montarFromLine(from?: string | null, fromName?: string | null): string | null {
  const email = (from || "").trim().replace(/^<|>$/g, "");
  if (!email) return null;
  const name = (fromName || "").trim();
  if (!name) return email.includes("<") ? email : email;
  if (email.includes("<") && email.includes(">")) return email;
  return `${name} <${email}>`;
}

function foldHeaderValue(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function montarCorpoMime(text: string, html?: string | null): { contentType: string; body: string } {
  const plain = (text || "").trim();
  const rich = (html || "").trim();
  if (!rich) {
    return {
      contentType: "Content-Type: text/plain; charset=utf-8",
      body: plain,
    };
  }

  const boundary = `waje_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    plain,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    rich,
    `--${boundary}--`,
    "",
  ];
  return {
    contentType: `Content-Type: multipart/alternative; boundary="${boundary}"`,
    body: parts.join("\r\n"),
  };
}

/** Envia e-mail via Gmail API (OAuth bearer). Suporta HTML multipart + threading RFC. */
export async function sendGmailEmail(input: SendGmailEmailInput): Promise<SendGmailEmailResult> {
  const token = input.bearerToken.trim();
  const to = input.to.trim();
  const subject = foldHeaderValue(input.subject || "");
  const text = (input.text || "").trim();
  const html = input.html?.trim() || "";

  if (!token) return { ok: false, error: "gmail_sem_token" };
  if (!to) return { ok: false, error: "Destinatário (to) obrigatório" };
  if (!subject) return { ok: false, error: "Assunto (subject) obrigatório" };
  if (!text && !html) return { ok: false, error: "Corpo (text ou html) obrigatório" };

  const fromLine = montarFromLine(input.from, input.fromName);
  if (!fromLine) return { ok: false, error: "Remetente (from) obrigatório para Gmail OAuth" };

  const mime = montarCorpoMime(text || html.replace(/<[^>]+>/g, " "), html || null);
  const lines = [
    `From: ${fromLine}`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    mime.contentType,
    `Subject: ${subject}`,
  ];
  if (input.inReplyTo?.trim()) lines.push(`In-Reply-To: ${foldHeaderValue(input.inReplyTo.trim())}`);
  if (input.references?.trim()) lines.push(`References: ${foldHeaderValue(input.references.trim())}`);
  lines.push("", mime.body);

  const raw = Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url");
  const body: Record<string, unknown> = { raw };
  if (input.threadId?.trim()) body.threadId = input.threadId.trim();

  const res = await gmailFetchJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { ok: false, error: "gmail_send_failed", status: res.status };
  }

  const out = res.body as { id?: string; threadId?: string } | null;
  return {
    ok: true,
    id: typeof out?.id === "string" ? out.id : undefined,
    threadId: typeof out?.threadId === "string" ? out.threadId : undefined,
  };
}
