/**
 * Detalhes com faixa própria (voltar, abas, badges) — não empilhar o header universal.
 */
export function shouldHideCrmUniversalHeader(pathname: string): boolean {
  if (pathname.startsWith("/crm/leads/") && pathname !== "/crm/leads") return true;
  if (pathname.startsWith("/crm/lead/")) return true;

  const parceiroSeg = pathname.match(/^\/crm\/parceiros\/([^/]+)$/);
  if (parceiroSeg?.[1] && parceiroSeg[1] !== "novo") return true;

  const agenteSeg = pathname.match(/^\/crm\/agentes\/([^/]+)$/);
  if (agenteSeg?.[1] && agenteSeg[1] !== "novo") return true;

  return false;
}
