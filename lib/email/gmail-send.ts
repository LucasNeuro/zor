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

function foldHeaderValue(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

/** Corrige assunto/corpo já corrompidos (UTF-8 interpretado como Latin-1). */
export function repararMojibakeUtf8(text: string): string {
  const t = text.trim();
  if (!t) return t;

  let cur = t;
  for (let pass = 0; pass < 3; pass++) {
    if (!/[ÃÂÕÑÒÓÚºª]/.test(cur)) break;
    try {
      const next = Buffer.from(cur, "latin1").toString("utf8");
      if (!next || next === cur || next.includes("\uFFFD")) break;
      cur = next;
    } catch {
      break;
    }
  }
  return cur;
}

/** RFC 2047 — UTF-8 Base64 para headers MIME (Subject, From name, etc.). */
export function encodeMimeHeaderValue(value: string): string {
  const repaired = repararMojibakeUtf8(foldHeaderValue(value));
  if (!repaired) return repaired;
  if (/^[\x20-\x7E]*$/.test(repaired)) return repaired;

  const prefix = "=?UTF-8?B?";
  const suffix = "?=";
  const maxB64Len = 45;
  const chars = [...repaired];
  const words: string[] = [];
  let i = 0;

  while (i < chars.length) {
    let slice = "";
    while (i < chars.length) {
      const candidate = slice + chars[i]!;
      const b64 = Buffer.from(candidate, "utf8").toString("base64");
      if (b64.length > maxB64Len && slice) break;
      slice = candidate;
      i++;
      if (b64.length > maxB64Len) break;
    }
    if (!slice) {
      slice = chars[i - 1] ?? chars[0] ?? "";
    }
    words.push(`${prefix}${Buffer.from(slice, "utf8").toString("base64")}${suffix}`);
  }

  return words.join("\r\n ");
}

function montarFromLine(from?: string | null, fromName?: string | null): string | null {
  const email = (from || "").trim().replace(/^<|>$/g, "");
  if (!email) return null;
  const name = repararMojibakeUtf8((fromName || "").trim());
  if (!name) return email.includes("<") ? email : email;
  if (email.includes("<") && email.includes(">")) return email;
  const encodedName = encodeMimeHeaderValue(name);
  return `${encodedName} <${email}>`;
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
  const subject = encodeMimeHeaderValue(input.subject || "");
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
