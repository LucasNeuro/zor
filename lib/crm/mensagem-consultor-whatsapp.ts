/** Tag visível no WhatsApp do lead: consultor + negócio/empresa. */
export function formatarMensagemConsultorWhatsapp(opts: {
  texto: string;
  consultorNome: string;
  negocioNome?: string | null;
}): string {
  const corpo = opts.texto.trim();
  const consultor = opts.consultorNome.trim() || "Consultor";
  const negocio = opts.negocioNome?.trim() ?? "";
  const tag = negocio
    ? `*[Consultor ${consultor} — ${negocio}]*`
    : `*[Consultor ${consultor}]*`;
  return `${tag}\n${corpo}`;
}

/** Exibe no CRM o texto digitado pelo operador (sem a tag enviada ao WhatsApp). */
export function textoExibicaoMensagemHumano(
  conteudo: string,
  metadata?: unknown
): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const original = (metadata as Record<string, unknown>).texto_original;
    if (typeof original === "string" && original.trim()) return original.trim();
  }
  const stripped = conteudo.replace(/^\*\[Consultor[^\]]*\]\*\s*\n?/i, "").trim();
  return stripped || conteudo;
}
