"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchCrmEmpresasList,
  prefetchCrmParceirosList,
  prefetchCrmPessoasList,
} from "@/hooks/useCrmListQueries";
import {
  prefetchCrmNegociosList,
  prefetchCrmPipelines,
  prefetchHubCiclosList,
} from "@/hooks/useCrmDataQueries";
import { prefetchHubAgentesList } from "@/hooks/useHubAgentesQueries";

/** Pré-carrega listas CRM/Hub ao abrir o módulo — cache de sessão (TanStack Query). */
export function CrmListPrefetcher() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  useEffect(() => {
    void prefetchCrmPessoasList(queryClient, {});
    void prefetchCrmEmpresasList(queryClient, {});
    void prefetchCrmParceirosList(queryClient);
    void prefetchHubAgentesList(queryClient, "todos");
    void prefetchHubAgentesList(queryClient, "ativos");
    void prefetchCrmPipelines(queryClient, "lead");
    void prefetchCrmPipelines(queryClient, "negocio");
    void prefetchCrmPipelines(queryClient, "atendimento");
    void prefetchCrmNegociosList(queryClient, { offset: 0 });
    void prefetchHubCiclosList(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (pathname.startsWith("/crm/agentes")) {
      void prefetchHubAgentesList(queryClient, "todos");
    }
    if (pathname.startsWith("/crm/ciclos")) {
      void prefetchHubCiclosList(queryClient);
      void prefetchHubAgentesList(queryClient, "todos");
    }
    if (pathname.startsWith("/crm/leads")) {
      void prefetchCrmPipelines(queryClient, "lead");
    }
    if (pathname.startsWith("/crm/negocios")) {
      void prefetchCrmPipelines(queryClient, "negocio");
      void prefetchCrmNegociosList(queryClient, { offset: 0 });
    }
    if (pathname.startsWith("/crm/atendimento")) {
      void prefetchCrmPipelines(queryClient, "atendimento");
    }
  }, [pathname, queryClient]);

  return null;
}
