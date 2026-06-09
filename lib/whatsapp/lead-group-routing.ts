import type { SupabaseClient } from "@supabase/supabase-js";
import { telefonesConversaEquivalentes } from "@/lib/crm/isolamento-conversa-lead";

export type LeadGroupRoutingRow = {
  id: string;
  telefone?: string | null;
  humano_responsavel?: string | null;
  agente_responsavel?: string | null;
  metadata?: unknown;
  pessoa_id?: string | null;
  tenant_id?: string | null;
};

export type GroupSenderRole = "cliente" | "humano";

export function leadMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function groupJidFromLead(lead: { metadata?: unknown }): string | null {
  const jid = leadMetadataRecord(lead.metadata).whatsapp_group_jid;
  return typeof jid === "string" && jid.trim() ? jid.trim() : null;
}

export function canalAtivoFromLead(lead: { metadata?: unknown }): string | null {
  const canal = leadMetadataRecord(lead.metadata).canal_ativo;
  return typeof canal === "string" && canal.trim() ? canal.trim() : null;
}

/** Transferência ativa para grupo WhatsApp (canal_ativo=group + JID persistido). */
export function isLeadGroupTransferActive(lead: { metadata?: unknown }): boolean {
  return canalAtivoFromLead(lead) === "group" && Boolean(groupJidFromLead(lead));
}

export function normalizeGroupJid(jid: string | null | undefined): string | null {
  const raw = typeof jid === "string" ? jid.trim() : "";
  if (!raw || !raw.includes("@g.us")) return null;
  return raw;
}

/** Busca lead com transferência de atendimento para o grupo informado. */
export async function findLeadByGroupJid(
  supabase: SupabaseClient,
  groupJid: string
): Promise<LeadGroupRoutingRow | null> {
  const jid = normalizeGroupJid(groupJid);
  if (!jid) return null;

  const { data, error } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, agente_responsavel, metadata, pessoa_id, tenant_id")
    .filter("metadata->>whatsapp_group_jid", "eq", jid)
    .maybeSingle();

  if (error) {
    console.warn("[WHATSAPP][GROUP] findLeadByGroupJid:", error.message);
    return null;
  }
  return (data as LeadGroupRoutingRow | null) ?? null;
}

/** fromMe → humano; telefone do lead → cliente; demais participantes → humano (vendedor). */
export function mapGroupMessageSender(params: {
  fromMe: boolean;
  senderTelefone: string;
  leadTelefone: string;
}): GroupSenderRole {
  if (params.fromMe) return "humano";
  if (telefonesConversaEquivalentes(params.senderTelefone, params.leadTelefone)) return "cliente";
  return "humano";
}

export function humanoSlugFromLead(lead: LeadGroupRoutingRow): string {
  const hr =
    typeof lead.humano_responsavel === "string" && lead.humano_responsavel.trim()
      ? lead.humano_responsavel.trim()
      : "";
  return hr || "humano";
}
