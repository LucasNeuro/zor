"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchCrmNegociosList,
  prefetchCrmPipelines,
  prefetchHubCiclosList,
} from "@/hooks/useCrmDataQueries";
import { prefetchHubAgentesList } from "@/hooks/useHubAgentesQueries";

type Props = ComponentProps<typeof Link>;

function hrefPath(href: Props["href"]): string {
  if (typeof href === "string") return href;
  if (href && typeof href === "object" && "pathname" in href) {
    return typeof href.pathname === "string" ? href.pathname : "";
  }
  return "";
}

/** Link CRM com prefetch de rota + cache TanStack Query. */
export function CrmPrefetchLink({ prefetch = true, href, onMouseEnter, ...props }: Props) {
  const qc = useQueryClient();
  const path = hrefPath(href);

  function warmListCache() {
    if (path.startsWith("/crm/pessoas")) {
      void prefetchCrmPipelines(qc, "lead");
    }
    if (path.startsWith("/crm/parceiros") || path.startsWith("/crm/cadastro")) {
      void prefetchCrmPipelines(qc, "lead");
    }
    if (path.startsWith("/crm/agentes")) {
      void prefetchHubAgentesList(qc, "todos");
      void prefetchHubAgentesList(qc, "ativos");
    }
    if (path.startsWith("/crm/ciclos") || path.startsWith("/crm/ferramentas") || path.startsWith("/crm/conhecimento")) {
      void prefetchHubCiclosList(qc);
      void prefetchHubAgentesList(qc, "todos");
    }
    if (path.startsWith("/crm/leads")) {
      void prefetchCrmPipelines(qc, "lead");
    }
    if (path.startsWith("/crm/negocios")) {
      void prefetchCrmPipelines(qc, "negocio");
      void prefetchCrmNegociosList(qc, { offset: 0 });
    }
  }

  return (
    <Link
      prefetch={prefetch}
      href={href}
      onMouseEnter={(e) => {
        warmListCache();
        onMouseEnter?.(e);
      }}
      {...props}
    />
  );
}
