/** Estágios padrão Waje — funil genérico por tipo (leads e negócios). */

export type PipelineTipo = "lead" | "negocio" | "atendimento";

export type EstagioPadrao = {
  slug: string;
  label: string;
  cor: string;
  ordem: number;
  tipo_fecho: "aberto" | "ganho" | "perdido";
};

/** Mínimo 3 estágios abertos + ganho/perdido opcionais para leads. */
export const ESTAGIOS_PADRAO_LEAD: EstagioPadrao[] = [
  { slug: "novo", label: "Novo", cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" },
  { slug: "em_atendimento", label: "Em atendimento", cor: "#3B82F6", ordem: 1, tipo_fecho: "aberto" },
  { slug: "qualificado", label: "Qualificado", cor: "#06B6D4", ordem: 2, tipo_fecho: "aberto" },
  { slug: "ganho", label: "✓ Ganhos", cor: "#22C55E", ordem: 3, tipo_fecho: "ganho" },
  { slug: "perdido", label: "✗ Perdidos", cor: "#EF4444", ordem: 4, tipo_fecho: "perdido" },
];

/** Funil de atendimento — conversas e fila humana/IA. */
export const ESTAGIOS_PADRAO_ATENDIMENTO: EstagioPadrao[] = [
  { slug: "novo", label: "Novo", cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" },
  { slug: "em_andamento", label: "Em andamento", cor: "#3B82F6", ordem: 1, tipo_fecho: "aberto" },
  { slug: "aguardando", label: "Aguardando", cor: "#EAB308", ordem: 2, tipo_fecho: "aberto" },
  { slug: "fechado", label: "Fechado", cor: "#22C55E", ordem: 3, tipo_fecho: "ganho" },
];

/** Funil comercial genérico para negócios. */
export const ESTAGIOS_PADRAO_NEGOCIO: EstagioPadrao[] = [
  { slug: "novo", label: "Novos", cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" },
  { slug: "qualificando", label: "Qualificando", cor: "#3B82F6", ordem: 1, tipo_fecho: "aberto" },
  { slug: "qualificado", label: "Qualificado", cor: "#06B6D4", ordem: 2, tipo_fecho: "aberto" },
  { slug: "proposta", label: "Proposta", cor: "#EAB308", ordem: 3, tipo_fecho: "aberto" },
  { slug: "negociando", label: "Negociando", cor: "#F97316", ordem: 4, tipo_fecho: "aberto" },
  { slug: "fechamento", label: "Fechamento", cor: "#A855F7", ordem: 5, tipo_fecho: "aberto" },
  { slug: "ganho", label: "✓ Ganhos", cor: "#22C55E", ordem: 6, tipo_fecho: "ganho" },
  { slug: "perdido", label: "✗ Perdidos", cor: "#EF4444", ordem: 7, tipo_fecho: "perdido" },
];

/** @deprecated Use `estagiosPadraoParaTipo`. Mantido para compatibilidade. */
export const ESTAGIOS_PADRAO = ESTAGIOS_PADRAO_NEGOCIO;

export function estagiosPadraoParaTipo(tipo: PipelineTipo): EstagioPadrao[] {
  if (tipo === "lead") return ESTAGIOS_PADRAO_LEAD;
  if (tipo === "atendimento") return ESTAGIOS_PADRAO_ATENDIMENTO;
  return ESTAGIOS_PADRAO_NEGOCIO;
}

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

/** Fallback UI quando tabelas hub_pipelines ainda não existem no ambiente. */
export const ESTAGIOS_FALLBACK_LEAD_UI = ESTAGIOS_PADRAO_LEAD.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));

export const ESTAGIOS_FALLBACK_NEGOCIO_UI = ESTAGIOS_PADRAO_NEGOCIO.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));

export const ESTAGIOS_FALLBACK_ATENDIMENTO_UI = ESTAGIOS_PADRAO_ATENDIMENTO.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));

/** @deprecated Use ESTAGIOS_FALLBACK_LEAD_UI ou ESTAGIOS_FALLBACK_NEGOCIO_UI. */
export const ESTAGIOS_FALLBACK_UI = ESTAGIOS_FALLBACK_NEGOCIO_UI;
