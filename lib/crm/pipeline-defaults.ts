/** Estágios padrão Obra10 (leads e negócios). */
export const ESTAGIOS_PADRAO = [
  { slug: "novo", label: "Novos", cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" as const },
  { slug: "qualificando", label: "Qualificando", cor: "#3B82F6", ordem: 1, tipo_fecho: "aberto" as const },
  { slug: "qualificado", label: "Qualificado", cor: "#06B6D4", ordem: 2, tipo_fecho: "aberto" as const },
  { slug: "proposta", label: "Proposta", cor: "#EAB308", ordem: 3, tipo_fecho: "aberto" as const },
  { slug: "negociando", label: "Negociando", cor: "#F97316", ordem: 4, tipo_fecho: "aberto" as const },
  { slug: "fechamento", label: "Fechamento", cor: "#A855F7", ordem: 5, tipo_fecho: "aberto" as const },
  { slug: "ganho", label: "✓ Ganhos", cor: "#22C55E", ordem: 6, tipo_fecho: "ganho" as const },
  { slug: "perdido", label: "✗ Perdidos", cor: "#EF4444", ordem: 7, tipo_fecho: "perdido" as const },
] as const;

export type PipelineTipo = "lead" | "negocio";

export type PipelineEstagioRow = {
  id: string;
  pipeline_id: string;
  slug: string;
  label: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  tipo_fecho: "aberto" | "ganho" | "perdido";
  sistema: boolean;
};

export type PipelineRow = {
  id: string;
  slug: string;
  nome: string;
  tipo: PipelineTipo;
  mercado_sigla: string | null;
  ativo: boolean;
  ordem: number;
};

/** Fallback quando tabelas hub_pipelines ainda não existem no ambiente. */
export const ESTAGIOS_FALLBACK_UI = ESTAGIOS_PADRAO.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));
