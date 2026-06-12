import { gmailFetchJson } from "@/lib/email/gmail-api";

export type SendGmailEmailInput = {
  bearerToken: string;
  to: string;
  subject: string;
  text: string;
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

/** Envia e-mail via Gmail API (OAuth bearer). Suporta threading RFC + threadId Gmail. */
export async function sendGmailEmail(input: SendGmailEmailInput): Promise<SendGmailEmailResult> {
  const token = input.bearerToken.trim();
  const to = input.to.trim();
  const subject = foldHeaderValue(input.subject || "");
  const text = (input.text || "").trim();

  if (!token) return { ok: false, error: "gmail_sem_token" };
  if (!to) return { ok: false, error: "Destinatário (to) obrigatório" };
  if (!subject) return { ok: false, error: "Assunto (subject) obrigatório" };
  if (!text) return { ok: false, error: "Corpo (text) obrigatório" };

  const fromLine = montarFromLine(input.from, input.fromName);
  if (!fromLine) return { ok: false, error: "Remetente (from) obrigatório para Gmail OAuth" };

  const lines = [`From: ${fromLine}`, `To: ${to}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8"];
  lines.push(`Subject: ${subject}`);
  if (input.inReplyTo?.trim()) lines.push(`In-Reply-To: ${foldHeaderValue(input.inReplyTo.trim())}`);
  if (input.references?.trim()) lines.push(`References: ${foldHeaderValue(input.references.trim())}`);
  lines.push("", text);

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
