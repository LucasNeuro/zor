/** Skill procedural (inspirado em Hermes / agentskills.io) — gerada a partir do cargo, não substitui o cargo. */
export type SuperagenteSkill = {
  id: string;
  titulo: string;
  descricao: string;
  ferramentas_sugeridas: string[];
};

export type SuperagenteHarnessConfig = {
  agenteSlug: string;
  agenteNome: string;
  cargo?: string | null;
  area?: string | null;
  skills: SuperagenteSkill[];
};

export type GraficoArtefatoSpec = {
  tipo: "bar" | "line" | "pie" | "doughnut";
  titulo?: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    cor?: string;
  }>;
};

export type KpiCorToken = "verde" | "azul" | "rosa" | "laranja" | "teal" | "roxo";

export type KpiArtefatoItem = {
  label: string;
  valor: string;
  /** Ex.: "+2,15%" ou "-3 contas" */
  delta?: string;
  delta_positivo?: boolean;
  cor?: KpiCorToken;
};

export type SecaoArtefatoSpec =
  | { tipo: "texto"; markdown?: string; html_seguro?: string }
  | { tipo: "grafico"; grafico: GraficoArtefatoSpec }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] }
  | { tipo: "kpi_row"; titulo?: string; itens: KpiArtefatoItem[] };

export type ArtefatoCanvasSpec = {
  titulo: string;
  subtitulo?: string;
  /** Tema claro recomendado para dashboards financeiros (fundo cinza-claro). */
  tema?: "claro" | "escuro";
  secoes: SecaoArtefatoSpec[];
};
