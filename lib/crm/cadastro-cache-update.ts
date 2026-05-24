import type { QueryClient } from "@tanstack/react-query";
import { crmQueryKeys, type CrmEmpresasFiltros, type CrmPessoasFiltros } from "@/lib/crm/crm-query-keys";
import type { EmpresaListaRow, PessoaListaRow } from "@/lib/crm/cadastro-list-columns";
import type { HubPessoaRow } from "@/lib/crm/hub-pessoas-compat";

export function hubPessoaToListaRow(p: HubPessoaRow): PessoaListaRow {
  return {
    ...p,
    id: String(p.id),
    nome: String(p.nome ?? ""),
  } as PessoaListaRow;
}

/** Insere o novo registo no cache sem refetch da lista (500 linhas). */
export function prependPessoaListaCache(
  queryClient: QueryClient,
  filtros: CrmPessoasFiltros,
  pessoa: HubPessoaRow
) {
  const row = hubPessoaToListaRow(pessoa);
  const keys = [crmQueryKeys.pessoas(filtros), crmQueryKeys.pessoas({})];
  for (const key of keys) {
    queryClient.setQueryData<PessoaListaRow[]>(key, (old) => {
      const prev = old ?? [];
      if (prev.some((x) => x.id === row.id)) return prev;
      return [row, ...prev];
    });
  }
}

export function prependEmpresaListaCache(
  queryClient: QueryClient,
  filtros: CrmEmpresasFiltros,
  empresa: EmpresaListaRow
) {
  const keys = [crmQueryKeys.empresas(filtros), crmQueryKeys.empresas({})];
  for (const key of keys) {
    queryClient.setQueryData<EmpresaListaRow[]>(key, (old) => {
      const prev = old ?? [];
      if (prev.some((x) => x.id === empresa.id)) return prev;
      return [empresa, ...prev];
    });
  }
}
