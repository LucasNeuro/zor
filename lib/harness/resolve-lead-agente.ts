/**
 * Resolve qual agente atende um lead (handoff playbook, metadata, agente_responsavel).
 */
export function extrairAgenteDestinoLeadMetadata(
  metadata: unknown
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  const dest =
    (typeof m.transfer_agente_destino === "string" && m.transfer_agente_destino.trim()) ||
    (typeof m.agente_destino === "string" && m.agente_destino.trim()) ||
    "";
  return dest || null;
}

export function resolverAgenteSlugParaLead(lead: {
  agente_responsavel?: string | null;
  metadata?: unknown;
}): string | null {
  const fromMeta = extrairAgenteDestinoLeadMetadata(lead.metadata);
  if (fromMeta) return fromMeta;
  const resp =
    typeof lead.agente_responsavel === "string" ? lead.agente_responsavel.trim() : "";
  return resp || null;
}
