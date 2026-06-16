/** Marca visível no WhatsApp quando um consultor responde pelo CRM. */
export const MARCA_TAG_WHATSAPP = "Waje";

/** Tag visível no WhatsApp do lead: marca Waje + nome do consultor. */
export function formatarMensagemConsultorWhatsapp(opts: {
  texto: string;
  consultorNome: string;
}): string {
  const corpo = opts.texto.trim();
  const consultor = opts.consultorNome.trim() || "Consultor";
  const tag = `*[${MARCA_TAG_WHATSAPP} · ${consultor}]*`;
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
  const stripped = conteudo.replace(/^\*\[[^\]]*\]\*\s*\n?/, "").trim();
  return stripped || conteudo;
}
