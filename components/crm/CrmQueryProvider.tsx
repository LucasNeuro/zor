"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_GC_MS, QUERY_STALE_DETAIL_MS } from "@/lib/crm/query-config";

/**
 * Cache cliente para dados CRM (TanStack Query) — deduplicação, staleness e menos “trancos” ao reabrir gavetas.
 * @see https://tanstack.com/query/latest
 */
export function CrmQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_STALE_DETAIL_MS,
            gcTime: QUERY_GC_MS,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
