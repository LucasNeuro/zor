/** Assinatura visível no WhatsApp quando um consultor responde pelo CRM. */
export function formatarMensagemConsultorWhatsapp(opts: {
  texto: string;
  consultorNome: string;
}): string {
  const corpo = opts.texto.trim();
  const consultor = opts.consultorNome.trim() || "Consultor";
  if (!corpo) return `*${consultor}*`;
  return `*${consultor}*\n${corpo}`;
}

const TAG_LEGADA = /^\*\[[^\]]*\]\*\s*\n?/;
const ASSINATURA_CONSULTOR = /^\*[^*\n]{1,80}\*\s*\n?/;

/** Exibe no CRM o texto digitado pelo operador (sem a assinatura enviada ao WhatsApp). */
export function textoExibicaoMensagemHumano(
  conteudo: string,
  metadata?: unknown
): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const original = (metadata as Record<string, unknown>).texto_original;
    if (typeof original === "string" && original.trim()) return original.trim();
  }
  const stripped = conteudo.replace(TAG_LEGADA, "").replace(ASSINATURA_CONSULTOR, "").trim();
  return stripped || conteudo;
}
