/** Detecta canais de atendimento de um lead (WhatsApp vs e-mail). */

export type LeadCanalInput = {
  origem?: string | null;
  telefone?: string | null;
  email?: string | null;
  metadata?: unknown;
};

function metaRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function canalMetadata(metadata: unknown): string {
  return String(metaRecord(metadata).canal ?? "").trim().toLowerCase();
}

/** Lead criado ou recontactado pelo canal e-mail (Resend inbound). */
export function leadEhCanalEmail(lead: LeadCanalInput): boolean {
  const origem = (lead.origem ?? "").trim().toLowerCase();
  if (origem === "email") return true;
  return canalMetadata(lead.metadata) === "email";
}

/** Lead com atendimento WhatsApp (padrão para leads legados com telefone). */
export function leadEhCanalWhatsapp(lead: LeadCanalInput): boolean {
  if (leadEhCanalEmail(lead)) {
    return Boolean(lead.telefone?.trim());
  }
  const origem = (lead.origem ?? "").trim().toLowerCase();
  if (origem === "whatsapp") return true;
  if (lead.telefone?.trim()) return true;
  const canal = canalMetadata(lead.metadata);
  if (canal === "whatsapp") return true;
  if (canal === "email") return false;
  return true;
}

export function labelCanalLead(lead: LeadCanalInput): "whatsapp" | "email" | "misto" | null {
  const wa = leadEhCanalWhatsapp(lead);
  const em = leadEhCanalEmail(lead);
  if (wa && em) return "misto";
  if (em) return "email";
  if (wa) return "whatsapp";
  return null;
}
