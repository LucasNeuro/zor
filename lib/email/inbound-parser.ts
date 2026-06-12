/** Normaliza payload inbound Resend (webhook `email.received` ou variantes). */

export type ParsedInboundEmail = {
  /** ID interno Resend (`email_id`) — usado para GET /emails/receiving/{id}. */
  resendEmailId: string | null;
  /** ID interno Gmail (`messages/{id}`). */
  gmailMessageId: string | null;
  /** Thread Gmail para resposta in-thread. */
  gmailThreadId: string | null;
  /** Message-ID RFC para threading (In-Reply-To / References). */
  messageId: string | null;
  fromEmail: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  text: string;
  html: string | null;
  inReplyTo: string | null;
  references: string | null;
  rawType: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizarEnderecoEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/<([^>]+)>/);
  const addr = (m?.[1] || s).trim().toLowerCase();
  return EMAIL_RE.test(addr) ? addr : null;
}

export function extrairNomeRemetente(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s*<[^>]+>$/);
  if (m?.[1]) {
    const name = m[1].replace(/^["']|["']$/g, "").trim();
    return name || null;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickAddresses(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") {
      const addr = normalizarEnderecoEmail(v);
      return addr ? [addr] : [];
    }
    if (Array.isArray(v)) {
      const out: string[] = [];
      for (const item of v) {
        const addr = normalizarEnderecoEmail(String(item));
        if (addr) out.push(addr);
      }
      if (out.length > 0) return out;
    }
  }
  return [];
}

function unwrapData(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return body;
}

export type ParseInboundEmailResult =
  | { ok: true; value: ParsedInboundEmail }
  | { ok: false; reason: string };

/** Converte body JSON do webhook Resend para forma normalizada. */
export function parseResendInboundWebhook(body: Record<string, unknown>): ParseInboundEmailResult {
  const root = unwrapData(body);
  const rawType =
    typeof body.type === "string"
      ? body.type
      : typeof body.event === "string"
        ? body.event
        : null;

  if (rawType && !/email\.received|inbound|received/i.test(rawType)) {
    return { ok: false, reason: `event_ignored:${rawType}` };
  }

  const fromRaw = pickString(root, ["from", "sender", "from_email"]);
  const fromEmail = normalizarEnderecoEmail(fromRaw);
  if (!fromEmail) {
    return { ok: false, reason: "missing_from_email" };
  }

  const toAddresses = pickAddresses(root, ["to", "recipient", "recipients", "email_to"]);
  if (toAddresses.length === 0) {
    return { ok: false, reason: "missing_to_address" };
  }

  const subject = pickString(root, ["subject", "email_subject"]) || "(sem assunto)";
  const text =
    pickString(root, ["text", "plain", "body_text", "text_body"]) ||
    pickString(root, ["snippet", "preview"]) ||
    "";
  const htmlRaw = pickString(root, ["html", "body_html", "html_body"]);
  const html = htmlRaw || null;

  const resendEmailId = pickString(root, ["email_id", "id"]) || pickString(body, ["id"]) || null;
  const messageId =
    pickString(root, ["message_id", "Message-Id", "messageId"]) ||
    null;

  const headers =
    root.headers && typeof root.headers === "object" && !Array.isArray(root.headers)
      ? (root.headers as Record<string, unknown>)
      : {};

  const inReplyTo =
    pickString(headers as Record<string, unknown>, ["in-reply-to", "In-Reply-To"]) ||
    pickString(root, ["in_reply_to", "inReplyTo"]) ||
    null;
  const references =
    pickString(headers as Record<string, unknown>, ["references", "References"]) ||
    pickString(root, ["references"]) ||
    null;

  const mensagemFinal = text.trim() || (html ? stripHtmlBasico(html) : "");
  if (!mensagemFinal.trim() && !resendEmailId) {
    return { ok: false, reason: "empty_body" };
  }

  return {
    ok: true,
    value: {
      resendEmailId,
      gmailMessageId: null,
      gmailThreadId: null,
      messageId,
      fromEmail,
      fromName: extrairNomeRemetente(fromRaw),
      toAddresses,
      subject,
      text: mensagemFinal,
      html,
      inReplyTo,
      references,
      rawType,
    },
  };
}

export function stripHtmlBasicoFromInbound(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlBasico(html: string): string {
  return stripHtmlBasicoFromInbound(html);
}
