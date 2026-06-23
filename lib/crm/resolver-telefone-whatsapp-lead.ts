import { normalizarTelefoneWhatsapp } from "@/lib/crm/sincronizar-contato-whatsapp";

function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

/**
 * Telefone efetivo para enviar WhatsApp ao lead.
 * Preferência: metadata.wa_telefone (sessão real do webhook) → coluna telefone.
 */
export function resolverTelefoneWhatsappLead(lead: {
  telefone?: string | null;
  metadata?: unknown;
}): string {
  const meta = metadataRecord(lead.metadata);
  const waTel = typeof meta.wa_telefone === "string" ? normalizarTelefoneWhatsapp(meta.wa_telefone) : "";
  const colTel = normalizarTelefoneWhatsapp(String(lead.telefone ?? ""));
  if (waTel.length >= 10) return waTel;
  return colTel;
}
