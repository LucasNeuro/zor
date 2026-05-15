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
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "").replace(/\D/g, "");
}

function parseUazapi(body: Record<string, unknown>): WhatsappWebhookParseResult | null {
  const eventRaw = (body.event as string) || (body.EventType as string) || (body.type as string) || "";
  const ev = eventRaw.toLowerCase();
  if (ev !== "message" && ev !== "messages") return null;

  let data = body.data as Record<string, unknown> | undefined;
  if (body.payload && typeof body.payload === "object") {
    const p = body.payload as Record<string, unknown>;
    if (p.data && typeof p.data === "object") data = p.data as Record<string, unknown>;
    else if (p.EventType || p.chatid) data = p as Record<string, unknown>;
  }
  if (!data || typeof data !== "object") {
    if ("chatid" in body || "messageid" in body || "sender" in body || "from" in body) {
      data = body as Record<string, unknown>;
    }
  }
  if (!data) return { kind: "ignored", status: "no_data" };

  const fromMe = data.fromMe === true;
  const chatid = String(data.chatid ?? "");
  const isGroup = data.isGroup === true || chatid.endsWith("@g.us");

  const senderJid = String(data.sender ?? data.from ?? "");
  const remoteJid = senderJid || chatid;
  const telefone = stripJidToDigits(remoteJid);
  const pushName = String(data.senderName ?? data.pushName ?? data.notifyName ?? "");

  const messageId = String(data.messageid ?? data.id ?? "");
  const ts = data.messageTimestamp;
  let timestamp: string;
  if (typeof ts === "number" && ts > 0) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    timestamp = new Date(ms).toISOString();
  } else {
    timestamp = new Date().toISOString();
  }

  const messageType = String(data.messageType ?? "conversation").toLowerCase();
  const tipoMidia =
    messageType.includes("image") ? "imagem" :
    messageType.includes("video") ? "video" :
    messageType.includes("audio") ? "audio" :
    messageType.includes("document") ? "documento" :
    "texto";

  let texto = String(data.text ?? "");
  if (!texto && typeof data.content === "string") texto = data.content;

  if (fromMe) return { kind: "ignored", status: "outgoing_ignored" };
  if (!telefone || isGroup) return { kind: "ignored", status: "group_ignored" };
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
      instance: (body.instance as string) || undefined,
    },
  };
}

export function parseWhatsappWebhookBody(body: Record<string, unknown>): WhatsappWebhookParseResult {
  const u = parseUazapi(body);
  if (u) return u;
  return { kind: "unknown_event", event: (body.event as string) || (body.type as string) };
}
