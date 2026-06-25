"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { crmQueryKeys } from "@/lib/crm/crm-query-keys";
import { fetchCrmLeadsList, type CrmLeadRow } from "@/lib/crm/crm-lead-list";
import { listQueryDefaults } from "@/lib/crm/query-config";

export type { CrmLeadRow };

export function prefetchCrmLeadsList(qc: QueryClient) {
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.leads(),
    queryFn: fetchCrmLeadsList,
    ...listQueryDefaults,
  });
}

export function useCrmLeadsList(enabled = true) {
  return useQuery({
    queryKey: crmQueryKeys.leads(),
    queryFn: fetchCrmLeadsList,
    enabled,
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function patchCrmLeadsListCache(
  qc: QueryClient,
  updater: (prev: CrmLeadRow[]) => CrmLeadRow[]
) {
  qc.setQueryData<CrmLeadRow[]>(crmQueryKeys.leads(), (prev) => updater(prev ?? []));
}

export function invalidateCrmLeadsList(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: crmQueryKeys.leads() });
}
