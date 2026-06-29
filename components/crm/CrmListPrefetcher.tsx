"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchCrmEmpresasList,
  prefetchCrmParceirosList,
  prefetchCrmPessoasList,
} from "@/hooks/useCrmListQueries";
import { CRM_MODULE_PARCEIROS_ENABLED } from "@/lib/crm/waje-modules";
import {
  prefetchCrmNegociosList,
  prefetchCrmPipelines,
  prefetchHubCiclosList,
} from "@/hooks/useCrmDataQueries";
import { prefetchHubAgentesList } from "@/hooks/useHubAgentesQueries";
import { prefetchCrmLeadsList } from "@/hooks/useCrmLeadsQueries";

function scheduleIdle(task: () => void, delayMs: number) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(() => task(), { timeout: delayMs + 500 });
    return () => window.cancelIdleCallback(id);
  }
  const t = setTimeout(task, delayMs);
  return () => clearTimeout(t);
}

/**
 * Pré-carrega listas CRM/Hub em ondas — evita burst de API/memória no arranque.
 */
export function CrmListPrefetcher() {
  const queryClient = useQueryClient();
  const pathname = usePathname();

  useEffect(() => {
    void prefetchCrmPipelines(queryClient, "lead");
    void prefetchCrmPipelines(queryClient, "atendimento");
    void prefetchHubAgentesList(queryClient, "todos");

    const cancelA = scheduleIdle(() => {
      void prefetchCrmLeadsList(queryClient);
    }, 400);

    const cancelB = scheduleIdle(() => {
      void prefetchCrmPipelines(queryClient, "negocio");
      void prefetchHubAgentesList(queryClient, "ativos");
    }, 1200);

    const cancelC = scheduleIdle(() => {
      void prefetchCrmPessoasList(queryClient, {});
      void prefetchCrmEmpresasList(queryClient, {});
      if (CRM_MODULE_PARCEIROS_ENABLED) {
        void prefetchCrmParceirosList(queryClient);
      }
      void prefetchCrmNegociosList(queryClient, { offset: 0 });
      void prefetchHubCiclosList(queryClient);
    }, 2500);

    return () => {
      cancelA();
      cancelB();
      cancelC();
    };
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
      void prefetchCrmLeadsList(queryClient);
    }
    if (pathname.startsWith("/crm/negocios")) {
      void prefetchCrmPipelines(queryClient, "negocio");
      void prefetchCrmNegociosList(queryClient, { offset: 0 });
    }
    if (pathname.startsWith("/crm/atendimentos")) {
      void prefetchCrmPipelines(queryClient, "atendimento");
      void prefetchCrmLeadsList(queryClient);
    }
    if (pathname.startsWith("/crm/atendimento")) {
      void prefetchCrmPipelines(queryClient, "atendimento");
    }
  }, [pathname, queryClient]);

  return null;
}
