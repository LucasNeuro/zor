/** Política de cache TanStack Query — listas e detalhes CRM/Hub. */
export const QUERY_STALE_LIST_MS = 10 * 60 * 1000;
export const QUERY_GC_MS = 45 * 60 * 1000;
export const QUERY_STALE_DETAIL_MS = 5 * 60 * 1000;
export const QUERY_STALE_OPERACAO_MS = 2 * 60 * 1000;

export const listQueryDefaults = {
  staleTime: QUERY_STALE_LIST_MS,
  gcTime: QUERY_GC_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const detailQueryDefaults = {
  staleTime: QUERY_STALE_DETAIL_MS,
  gcTime: QUERY_GC_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const operacaoQueryDefaults = {
  staleTime: QUERY_STALE_OPERACAO_MS,
  gcTime: QUERY_GC_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
