/** Extrai ID da mensagem WhatsApp da resposta UAZAPI (/send/text, /send/media). */
export function extrairWhatsappMessageIdDeRespostaUazapi(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") {
    const s = body.trim();
    return s.length > 4 ? s : null;
  }
  if (typeof body !== "object") return null;

  const visit = (obj: Record<string, unknown>): string | null => {
    for (const key of ["id", "messageId", "message_id", "whatsapp_message_id"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim().length > 4) return v.trim();
    }
    return null;
  };

  const root = body as Record<string, unknown>;
  const direct = visit(root);
  if (direct) return direct;

  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const nested = visit(root.data as Record<string, unknown>);
    if (nested) return nested;
  }

  if (root.message && typeof root.message === "object" && !Array.isArray(root.message)) {
    const nested = visit(root.message as Record<string, unknown>);
    if (nested) return nested;
  }

  return null;
}
