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

export type SecaoArtefatoSpec =
  | { tipo: "texto"; markdown?: string; html_seguro?: string }
  | { tipo: "grafico"; grafico: GraficoArtefatoSpec }
  | { tipo: "tabela"; colunas: string[]; linhas: string[][] };

export type ArtefatoCanvasSpec = {
  titulo: string;
  subtitulo?: string;
  tema?: "claro" | "escuro";
  secoes: SecaoArtefatoSpec[];
};
