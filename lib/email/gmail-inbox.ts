import {
  bearerTokenFromCredenciais,
  decodeBase64Url,
  gmailFetchJson,
  headerValue,
  parseAddressList,
} from "@/lib/email/gmail-api";
import {
  extrairNomeRemetente,
  normalizarEnderecoEmail,
  stripHtmlBasicoFromInbound,
  type ParsedInboundEmail,
} from "@/lib/email/inbound-parser";

export type GmailMessageListItem = {
  id: string;
  threadId?: string;
};

export type GmailListMessagesResult =
  | { ok: true; messages: GmailMessageListItem[] }
  | { ok: false; error: string; status?: number };

export type GmailFetchMessageResult =
  | { ok: true; inbound: ParsedInboundEmail }
  | { ok: false; error: string; status?: number };

export type GmailProfileResult =
  | { ok: true; emailAddress: string }
  | { ok: false; error: string; status?: number };

function authHeaders(bearerToken: string): Record<string, string> {
  return { Authorization: `Bearer ${bearerToken}` };
}

function extractBodyFromPayload(payload: Record<string, unknown>): { text: string; html: string | null } {
  const mime = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const bodyData =
    payload.body &&
    typeof payload.body === "object" &&
    !Array.isArray(payload.body) &&
    typeof (payload.body as { data?: unknown }).data === "string"
      ? (payload.body as { data: string }).data
      : null;

  if (bodyData) {
    const decoded = decodeBase64Url(bodyData);
    if (mime.includes("text/html")) return { text: stripHtmlBasicoFromInbound(decoded), html: decoded };
    return { text: decoded, html: null };
  }

  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  let html: string | null = null;
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    const partMime = typeof p.mimeType === "string" ? p.mimeType : "";
    const nested = extractBodyFromPayload(p);
    if (partMime.includes("text/plain") && nested.text.trim()) {
      return { text: nested.text, html: nested.html ?? html };
    }
    if (partMime.includes("text/html") && nested.html) html = nested.html;
    if (nested.text.trim() && !html) return nested;
  }
  if (html) return { text: stripHtmlBasicoFromInbound(html), html };
  return { text: "", html: null };
}

/** Lista mensagens não lidas recentes na inbox (Gmail API). */
export async function listGmailUnreadMessages(
  bearerToken: string,
  opts?: { maxResults?: number; query?: string }
): Promise<GmailListMessagesResult> {
  const token = bearerToken.trim();
  if (!token) return { ok: false, error: "gmail_sem_token" };

  const maxResults = Math.min(Math.max(opts?.maxResults ?? 20, 1), 50);
  const q = encodeURIComponent(opts?.query ?? "is:unread in:inbox newer_than:7d");
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxResults}`;

  const res = await gmailFetchJson(url, { method: "GET", headers: authHeaders(token) });
  if (!res.ok) {
    return { ok: false, error: "gmail_list_failed", status: res.status };
  }

  const body = res.body as { messages?: Array<{ id?: string; threadId?: string }> } | null;
  const messages: GmailMessageListItem[] = [];
  for (const m of body?.messages ?? []) {
    if (typeof m.id === "string" && m.id.trim()) {
      messages.push({ id: m.id.trim(), threadId: typeof m.threadId === "string" ? m.threadId : undefined });
    }
  }
  return { ok: true, messages };
}

/** Obtém perfil Gmail (endereço da caixa conectada). */
export async function fetchGmailProfile(bearerToken: string): Promise<GmailProfileResult> {
  const token = bearerToken.trim();
  if (!token) return { ok: false, error: "gmail_sem_token" };

  const res = await gmailFetchJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) return { ok: false, error: "gmail_profile_failed" };

  const body = res.body as { emailAddress?: string } | null;
  const emailAddress = typeof body?.emailAddress === "string" ? body.emailAddress.trim().toLowerCase() : "";
  if (!emailAddress) return { ok: false, error: "gmail_profile_sem_email" };
  return { ok: true, emailAddress };
}

/** Busca mensagem completa e converte para ParsedInboundEmail. */
export async function fetchGmailMessageAsInbound(
  bearerToken: string,
  messageId: string,
  threadId?: string | null
): Promise<GmailFetchMessageResult> {
  const token = bearerToken.trim();
  const id = messageId.trim();
  if (!token) return { ok: false, error: "gmail_sem_token" };
  if (!id) return { ok: false, error: "gmail_message_id_obrigatorio" };

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
  const res = await gmailFetchJson(url, { method: "GET", headers: authHeaders(token) });
  if (!res.ok) return { ok: false, error: "gmail_get_failed", status: res.status };

  const msg = res.body as {
    id?: string;
    threadId?: string;
    payload?: Record<string, unknown>;
  } | null;

  const payload = msg?.payload;
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "gmail_payload_vazio" };
  }

  const headers = Array.isArray(payload.headers)
    ? (payload.headers as Array<{ name?: string; value?: string }>)
    : [];

  const fromRaw = headerValue(headers, "From");
  const fromEmail = normalizarEnderecoEmail(fromRaw);
  if (!fromEmail) return { ok: false, error: "gmail_sem_from" };

  const toRaw = headerValue(headers, "To");
  const ccRaw = headerValue(headers, "Cc");
  const toAddresses = [...parseAddressList(toRaw), ...parseAddressList(ccRaw)];
  if (toAddresses.length === 0) {
    const deliveredTo = headerValue(headers, "Delivered-To");
    const addr = normalizarEnderecoEmail(deliveredTo);
    if (addr) toAddresses.push(addr);
  }
  if (toAddresses.length === 0) return { ok: false, error: "gmail_sem_to" };

  const subject = headerValue(headers, "Subject") || "(sem assunto)";
  const messageIdHeader = headerValue(headers, "Message-ID") || headerValue(headers, "Message-Id");
  const inReplyTo = headerValue(headers, "In-Reply-To");
  const references = headerValue(headers, "References");

  const { text, html } = extractBodyFromPayload(payload);
  const mensagemFinal = text.trim() || (html ? stripHtmlBasicoFromInbound(html) : "");
  if (!mensagemFinal.trim()) return { ok: false, error: "gmail_corpo_vazio" };

  return {
    ok: true,
    inbound: {
      resendEmailId: null,
      gmailMessageId: msg?.id ?? id,
      gmailThreadId: msg?.threadId ?? threadId ?? null,
      messageId: messageIdHeader,
      fromEmail,
      fromName: extrairNomeRemetente(fromRaw),
      toAddresses,
      subject,
      text: mensagemFinal,
      html,
      inReplyTo,
      references,
      rawType: "gmail.inbox",
    },
  };
}

/** Remove label UNREAD após processamento. */
export async function markGmailMessageRead(bearerToken: string, messageId: string): Promise<void> {
  const token = bearerToken.trim();
  const id = messageId.trim();
  if (!token || !id) return;

  await gmailFetchJson(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}/modify`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );
}

export { bearerTokenFromCredenciais };
