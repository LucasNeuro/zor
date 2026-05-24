"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchCrmEmpresasList, prefetchCrmParceirosList, prefetchCrmPessoasList } from "@/hooks/useCrmListQueries";

/** Pré-carrega listas CRM ao abrir o módulo — cache de sessão (TanStack Query). */
export function CrmListPrefetcher() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void prefetchCrmPessoasList(queryClient, {});
    void prefetchCrmEmpresasList(queryClient, {});
    void prefetchCrmParceirosList(queryClient);
  }, [queryClient]);

  return null;
}
