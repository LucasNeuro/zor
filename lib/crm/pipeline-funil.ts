/** Estágios do funil de leads (ordem comercial). */
export const FUNIL_LEADS = [
  { id: "novo", label: "Novos", short: "Novos", color: "#6B7280" },
  { id: "qualificando", label: "Qualificando", short: "Qualif.", color: "#3B82F6" },
  { id: "qualificado", label: "Qualificado", short: "OK", color: "#06B6D4" },
  { id: "proposta", label: "Proposta", short: "Proposta", color: "#EAB308" },
  { id: "negociando", label: "Negociando", short: "Negoc.", color: "#F97316" },
  { id: "fechamento", label: "Fechamento", short: "Fecham.", color: "#A855F7" },
] as const;

export const FUNIL_LEADS_OUTCOMES = [
  { id: "ganho", label: "Ganhos", color: "#22C55E" },
  { id: "perdido", label: "Perdidos", color: "#EF4444" },
] as const;

export const FUNIL_NEGOCIOS = [
  { id: "briefing", label: "Briefing", color: "#3b82f6" },
  { id: "match", label: "Match", color: "#f59e0b" },
  { id: "sit-down", label: "Sit-down", color: "#a855f7" },
  { id: "concluido", label: "Concluído", color: "#22c55e" },
] as const;

export type EstagioLeadId = (typeof FUNIL_LEADS)[number]["id"];
export type EtapaNegocioId = (typeof FUNIL_NEGOCIOS)[number]["id"];

export function moedaPipeline(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function taxaConversao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return atual > 0 ? 100 : null;
  return Math.round((atual / anterior) * 100);
}

export function corConversao(pct: number | null): string {
  if (pct == null) return "#484f58";
  if (pct >= 50) return "#22c55e";
  if (pct >= 25) return "#eab308";
  return "#ef4444";
}

/** Largura relativa para efeito funil (mín. 28%, máx. 100%). */
export function larguraFunil(count: number, topo: number): number {
  if (topo <= 0) return count > 0 ? 100 : 28;
  return Math.max(28, Math.min(100, Math.round((count / topo) * 100)));
}
