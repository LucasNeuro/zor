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

export const crmQueryKeys = {
  all: ["crm"] as const,
  pessoas: (f: CrmPessoasFiltros = {}) =>
    [...crmQueryKeys.all, "pessoas", f] as const,
  empresas: (f: CrmEmpresasFiltros = {}) =>
    [...crmQueryKeys.all, "empresas", f] as const,
  parceiros: () => [...crmQueryKeys.all, "parceiros", "lista"] as const,
};
