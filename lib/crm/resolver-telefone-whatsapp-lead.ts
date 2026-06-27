import { normalizarTelefoneWhatsapp } from "@/lib/crm/sincronizar-contato-whatsapp";

function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

/** Corrige prefixo 55 duplicado (ex. 555584550064 → 5584550064). */
export function corrigirTelefoneWhatsappDuplicado(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("5555") && d.length >= 12) {
    return `55${d.slice(4)}`;
  }
  return d;
}

function jidWhatsappValido(jid: string): boolean {
  const j = jid.trim();
  if (!j) return false;
  return (
    j.includes("@s.whatsapp.net") ||
    j.includes("@lid") ||
    j.includes("@g.us") ||
    j.includes("@newsletter")
  );
}

/**
 * Telefone efetivo para enviar WhatsApp ao lead (só dígitos).
 * Preferência: metadata.wa_telefone → coluna telefone, com correção de 55 duplicado.
 */
export function resolverTelefoneWhatsappLead(lead: {
  telefone?: string | null;
  metadata?: unknown;
}): string {
  const meta = metadataRecord(lead.metadata);
  const waTel =
    typeof meta.wa_telefone === "string" ? corrigirTelefoneWhatsappDuplicado(meta.wa_telefone) : "";
  const colTel = corrigirTelefoneWhatsappDuplicado(String(lead.telefone ?? ""));
  if (waTel.length >= 10) return waTel;
  return colTel;
}

/**
 * Destino para UAZAPI `number`: prefere wa_chatid (JID real da sessão), depois dígitos@s.whatsapp.net.
 */
export function resolverDestinoWhatsappLead(lead: {
  telefone?: string | null;
  metadata?: unknown;
}): string {
  const meta = metadataRecord(lead.metadata);
  const chatid = typeof meta.wa_chatid === "string" ? meta.wa_chatid.trim() : "";
  if (chatid && jidWhatsappValido(chatid)) return chatid;

  const digits = resolverTelefoneWhatsappLead(lead);
  if (digits.length >= 10) return `${digits}@s.whatsapp.net`;
  return digits;
}

export { normalizarTelefoneWhatsapp };
