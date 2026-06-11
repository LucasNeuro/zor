/** Extensões indexáveis no RAG (extração local, sem OCR). */
export const RAG_EXTENSOES_ACEITAS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".xml",
  ".pdf",
  ".docx",
  ".odt",
  ".rtf",
  ".html",
  ".htm",
  ".xlsx",
  ".pptx",
] as const;

export type RagExtensaoAceita = (typeof RAG_EXTENSOES_ACEITAS)[number];

/** Valor do atributo `accept` no input file do wizard. */
export const RAG_ACCEPT_ATTR = RAG_EXTENSOES_ACEITAS.join(",");

/** Extensões + MIME types — melhora seleção múltipla no diálogo do Windows. */
export const RAG_ACCEPT_INPUT_ATTR = [
  ...RAG_EXTENSOES_ACEITAS,
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
  "application/pdf",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
].join(",");

/** Exemplo público para download quando PDF/imagem falha. */
export const RAG_EXEMPLO_MD_URL = "/rag-exemplos/exemplo-rag-sdr-waje.md";

export const RAG_FORMATOS_RESUMO =
  ".txt, .md, .csv, .json, .xml, .pdf, .docx, .odt, .rtf, .html, .xlsx, .pptx";

export function extensaoArquivo(nome: string): string {
  const base = nome.trim().toLowerCase();
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i) : "";
}

export function ragExtensaoAceita(nome: string): boolean {
  const ext = extensaoArquivo(nome);
  return (RAG_EXTENSOES_ACEITAS as readonly string[]).includes(ext);
}

export function ragErroPdfSemTexto(msg: string): boolean {
  return /pdf enviado|extrair texto suficiente|digitalizad|sem texto suficiente no pdf/i.test(msg);
}

export function ragErroFormato(msg: string): boolean {
  return /formato ainda não|formato não suportado|não indexável/i.test(msg);
}
