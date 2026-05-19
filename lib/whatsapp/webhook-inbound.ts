/**
 * Normaliza payloads UAZAPI (event message/messages → data tipo Message).
 */

export type NormalizedWhatsappInbound = {
  telefone: string;
  pushName: string;
  messageId: string;
  timestamp: string;
  fromMe: boolean;
  isGroup: boolean;
  tipoMidia: string;
  texto: string;
  mensagemFinal: string;
  instance?: string;
};

export type WhatsappWebhookParseResult =
  | { kind: "ok"; value: NormalizedWhatsappInbound }
  | { kind: "ignored"; status: string; body?: Record<string, unknown> }
  | { kind: "unknown_event"; event?: string };

function stripJidToDigits(jid: string): string {
  return jid
    .replace(/@s\.whatsapp\.net/gi, "")
    .replace(/@g\.us/gi, "")
    .replace(/@lid/gi, "")
    .replace(/\D/g, "");
}

/** ID da instância no webhook global UAZAPI (string ou objeto com id). */
export function normalizeWebhookInstanceId(body: Record<string, unknown>): string | undefined {
  const fromRoot = pickStr(body, "instanceId", "instance_id");
  if (fromRoot) return fromRoot;

  const raw = body.instance ?? body.Instance;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const id = pickStr(o, "id", "instanceId", "instance_id");
    if (id) return id;
  }
  return undefined;
}

/** Webhook global UAZAPI envia muitas vezes `token` (instância) sem `instance` id. */
export function extractWebhookInstanceRefs(body: Record<string, unknown>): {
  instanceId?: string;
  instanceToken?: string;
} {
  let instanceId = normalizeWebhookInstanceId(body);

  const buckets: Record<string, unknown>[] = [body];
  const payload = body.payload ?? body.Payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    buckets.push(payload as Record<string, unknown>);
  }
  const rawData = body.data ?? body.Data;
  if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === "object" && rawData[0] !== null) {
    buckets.push(rawData[0] as Record<string, unknown>);
  } else if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    buckets.push(rawData as Record<string, unknown>);
  }
  const data = resolverDataMensagem(body);
  if (data) buckets.push(data);

  let instanceToken: string | undefined;
  for (const b of buckets) {
    const t = pickStr(b, "token", "instanceToken", "instance_token", "apitoken", "apiToken");
    if (t) {
      instanceToken = t;
      break;
    }
    const inst = b.instance ?? b.Instance;
    if (inst && typeof inst === "object" && inst !== null) {
      const o = inst as Record<string, unknown>;
      const tok = pickStr(o, "token");
      if (tok) instanceToken = tok;
      if (!instanceId) {
        const id = pickStr(o, "id", "instanceId", "instance_id");
        if (id) instanceId = id;
      }
    }
    if (!instanceId) {
      const id = pickStr(b, "instanceId", "instance_id");
      if (id) instanceId = id;
    }
  }

  return {
    ...(instanceId ? { instanceId } : {}),
    ...(instanceToken ? { instanceToken } : {}),
  };
}

function pickStr(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function extrairTextoDeContentObj(o: Record<string, unknown>): string {
  for (const k of ["conversation", "text", "caption", "body", "displayText"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const nested = ["extendedTextMessage", "imageMessage", "videoMessage", "buttonsResponseMessage"];
  for (const nk of nested) {
    const block = o[nk];
    if (block && typeof block === "object" && !Array.isArray(block)) {
      const t = pickStr(block as Record<string, unknown>, "text", "caption", "contentText", "selectedDisplayText");
      if (t) return t;
    }
  }
  return "";
}

function extrairTextoMensagem(data: Record<string, unknown>): string {
  let texto = pickStr(data, "text", "body", "messageText");
  if (texto) return texto;

  const content = data.content;
  if (typeof content === "string") {
    const c = content.trim();
    if (!c) return "";
    if (!c.startsWith("{") && !c.startsWith("[")) return c;
    try {
      const parsed = JSON.parse(c) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return extrairTextoDeContentObj(parsed as Record<string, unknown>);
      }
    } catch {
      return c;
    }
  }

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return extrairTextoDeContentObj(content as Record<string, unknown>);
  }

  const msg = data.message;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    return extrairTextoDeContentObj(msg as Record<string, unknown>);
  }

  return "";
}

function resolverDataMensagem(body: Record<string, unknown>): Record<string, unknown> | null {
  const rawData = body.data ?? body.Data;
  if (Array.isArray(rawData) && rawData.length > 0) {
    const first = rawData[0];
    if (first && typeof first === "object") return first as Record<string, unknown>;
  }
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    return rawData as Record<string, unknown>;
  }

  const message = body.message ?? body.Message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    return message as Record<string, unknown>;
  }

  const payload = body.payload ?? body.Payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    const pData = p.data ?? p.Data;
    if (Array.isArray(pData) && pData.length > 0 && typeof pData[0] === "object") {
      return pData[0] as Record<string, unknown>;
    }
    if (pData && typeof pData === "object" && !Array.isArray(pData)) {
      return pData as Record<string, unknown>;
    }
    if (p.message && typeof p.message === "object" && !Array.isArray(p.message)) {
      return p.message as Record<string, unknown>;
    }
    if (
      pickStr(p, "chatid", "chatId", "wa_chatid", "messageid", "messageId") ||
      p.EventType ||
      p.event
    ) {
      return p;
    }
  }

  if (
    pickStr(body, "chatid", "chatId", "wa_chatid", "messageid", "messageId") ||
    pickStr(body, "sender", "from") ||
    body.EventType ||
    body.event
  ) {
    return body;
  }

  return null;
}

function eventoEhMensagemInbound(eventRaw: string): boolean {
  const ev = eventRaw.trim().toLowerCase();
  if (!ev) return false;
  if (ev.includes("update") || ev.includes("ack") || ev.includes("reaction")) return false;
  if (ev === "message" || ev === "messages") return true;
  if (ev.includes("message")) return true;
  return false;
}

function parseUazapi(body: Record<string, unknown>): WhatsappWebhookParseResult | null {
  const eventRaw =
    pickStr(body, "event", "EventType", "type", "Type") ||
    (typeof body.payload === "object" && body.payload !== null
      ? pickStr(body.payload as Record<string, unknown>, "event", "EventType", "type")
      : "");

  if (!eventoEhMensagemInbound(eventRaw)) return null;

  const data = resolverDataMensagem(body);
  if (!data) return { kind: "ignored", status: "no_data" };

  const fromMe = data.fromMe === true || data.from_me === true;
  const chatid = pickStr(data, "chatid", "chatId", "wa_chatid", "remoteJid", "remote_jid");
  const isGroup =
    data.isGroup === true ||
    data.is_group === true ||
    chatid.endsWith("@g.us") ||
    chatid.includes("@g.us");

  const senderJid = pickStr(data, "sender", "from", "sender_pn", "participant", "author");
  const remoteJid = senderJid || chatid;
  const telefone = stripJidToDigits(remoteJid);
  const pushName = pickStr(data, "senderName", "pushName", "notifyName", "wa_contactName", "wa_name");

  const messageId = pickStr(data, "messageid", "messageId", "id");
  const ts = data.messageTimestamp ?? data.message_timestamp ?? data.timestamp;
  let timestamp: string;
  if (typeof ts === "number" && ts > 0) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    timestamp = new Date(ms).toISOString();
  } else if (typeof ts === "string" && ts.trim()) {
    const n = Number(ts);
    timestamp = Number.isFinite(n) && n > 0 ? new Date(n > 1e12 ? n : n * 1000).toISOString() : new Date().toISOString();
  } else {
    timestamp = new Date().toISOString();
  }

  const messageType = pickStr(data, "messageType", "message_type", "type").toLowerCase() || "conversation";
  const tipoMidia =
    messageType.includes("image") ? "imagem" :
    messageType.includes("video") ? "video" :
    messageType.includes("audio") || messageType.includes("ptt") ? "audio" :
    messageType.includes("document") ? "documento" :
    "texto";

  const texto = extrairTextoMensagem(data);

  if (fromMe) return { kind: "ignored", status: "outgoing_ignored" };
  if (!telefone || telefone.length < 10 || isGroup) {
    return { kind: "ignored", status: isGroup ? "group_ignored" : "invalid_phone" };
  }
  if (!texto && tipoMidia === "texto") return { kind: "ignored", status: "empty_message" };

  const mensagemFinal = texto || `[${tipoMidia} recebido]`;

  return {
    kind: "ok",
    value: {
      telefone,
      pushName,
      messageId,
      timestamp,
      fromMe,
      isGroup,
      tipoMidia,
      texto,
      mensagemFinal,
      instance: normalizeWebhookInstanceId(body),
    },
  };
}

export function parseWhatsappWebhookBody(body: Record<string, unknown>): WhatsappWebhookParseResult {
  const u = parseUazapi(body);
  if (u) return u;
  return { kind: "unknown_event", event: pickStr(body, "event", "EventType", "type") };
}
