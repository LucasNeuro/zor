/** Chaves TanStack Query para listas CRM — cache partilhado entre navegações. */
export type CrmPessoasFiltros = {
  busca?: string;
  tipo_pessoa?: string;
  estado?: string;
  origem?: string;
  area_atuacao?: string;
};

export type CrmEmpresasFiltros = {
  busca?: string;
  segmento?: string;
  prefixo_mercado?: string;
  estado?: string;
  ativo?: string;
};

export type CrmNegociosFiltros = {
  busca?: string;
  etapa?: string;
  pipelineId?: string | null;
  offset?: number;
};

export const crmQueryKeys = {
  all: ["crm"] as const,
  pessoas: (f: CrmPessoasFiltros = {}) => [...crmQueryKeys.all, "pessoas", f] as const,
  empresas: (f: CrmEmpresasFiltros = {}) => [...crmQueryKeys.all, "empresas", f] as const,
  parceiros: () => [...crmQueryKeys.all, "parceiros", "lista"] as const,
  pipelines: (tipo: "lead" | "negocio") => [...crmQueryKeys.all, "pipelines", tipo] as const,
  negocios: (f: CrmNegociosFiltros = {}) => [...crmQueryKeys.all, "negocios", f] as const,
  imoveis: (busca?: string) => [...crmQueryKeys.all, "imoveis", { busca: busca ?? "" }] as const,
};
