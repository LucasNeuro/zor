/** Monta texto de consulta para RAG a partir da mensagem atual + histórico recente. */

export type TurnoConsultaRag = { role: "user" | "assistant"; content: string };

const CONSULTA_RAG_MIN_CHARS = 12;
const CONSULTA_RAG_FALLBACK =
  "preços serviços produtos tabela orçamento reparo garantia atendimento empresa";

export function montarConsultaRagConversa(
  mensagemAtual: string,
  turnosConversa?: TurnoConsultaRag[],
  maxChars = 520
): string {
  const atual = mensagemAtual.trim();
  if (!turnosConversa?.length) return atual;

  const users = turnosConversa
    .filter((t) => t.role === "user")
    .map((t) => t.content.trim())
    .filter(Boolean);

  const parts: string[] = [];
  const recentUsers = users.slice(-6);
  for (const u of recentUsers) {
    if (!parts.includes(u)) parts.push(u);
  }
  if (!parts.length || parts[parts.length - 1] !== atual) {
    parts.push(atual);
  }

  const assistants = turnosConversa
    .filter((t) => t.role === "assistant")
    .slice(-3)
    .map((t) => t.content.trim())
    .filter(Boolean);

  const combined = [...parts, ...assistants].join(" | ").replace(/\s+/g, " ").trim();
  if (!combined) return atual;
  if (combined.length <= maxChars) return combined;
  return combined.slice(-maxChars).trim() || atual;
}

/** Garante consulta longa o suficiente para embedding/RAG (evita «oi», «azul» isolados). */
export function resolverConsultaRagParaBusca(
  mensagemAtual: string,
  turnosConversa?: TurnoConsultaRag[]
): string {
  const base = montarConsultaRagConversa(mensagemAtual, turnosConversa);
  if (base.length >= CONSULTA_RAG_MIN_CHARS) return base;
  const extra = [base, CONSULTA_RAG_FALLBACK].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return extra.length >= CONSULTA_RAG_MIN_CHARS ? extra : CONSULTA_RAG_FALLBACK;
}
