"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchCrmEmpresasList,
  prefetchCrmParceirosList,
  prefetchCrmPessoasList,
} from "@/hooks/useCrmListQueries";

type Props = ComponentProps<typeof Link>;

function hrefPath(href: Props["href"]): string {
  if (typeof href === "string") return href;
  if (href && typeof href === "object" && "pathname" in href) {
    return typeof href.pathname === "string" ? href.pathname : "";
  }
  return "";
}

/** Link CRM com prefetch de rota + listas CRM em cache de sessão. */
export function CrmPrefetchLink({ prefetch = true, href, onMouseEnter, ...props }: Props) {
  const qc = useQueryClient();
  const path = hrefPath(href);

  function warmListCache() {
    if (path.startsWith("/crm/cadastro") || path.startsWith("/crm/pessoas")) {
      void prefetchCrmPessoasList(qc, {});
      void prefetchCrmEmpresasList(qc, {});
    }
    if (path.startsWith("/crm/parceiros")) {
      void prefetchCrmParceirosList(qc);
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
