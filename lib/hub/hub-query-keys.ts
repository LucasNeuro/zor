import type { QueryClient } from "@tanstack/react-query";
import type { HubCargoCatalogRow } from "@/lib/hub/fetch-hub-cargos-catalog";

export type HubAgentesListMode = "todos" | "ativos" | "inativos" | "arquivados";

/** Referência estável — evita loops de invalidate quando usada em deps de useEffect. */
export const hubAgentesRootKey = ["hub", "agentes"] as const;

export const hubQueryKeys = {
  all: ["hub"] as const,
  agentes: {
    all: () => hubAgentesRootKey,
    list: (modo: HubAgentesListMode) => [...hubAgentesRootKey, "list", modo] as const,
    detail: (slug: string) => [...hubAgentesRootKey, "detail", slug] as const,
    logs: (slug: string) => [...hubAgentesRootKey, slug, "logs"] as const,
    operacao: (slug: string) => [...hubAgentesRootKey, slug, "operacao"] as const,
  },
  ciclos: {
    all: () => [...hubQueryKeys.all, "ciclos"] as const,
    list: () => [...hubQueryKeys.ciclos.all(), "list"] as const,
    logRecent: () => [...hubQueryKeys.ciclos.all(), "log-recent"] as const,
    logByCiclo: (cicloId: string) => [...hubQueryKeys.ciclos.all(), "log", cicloId] as const,
  },
  alertas: (resolvido = false) => [...hubQueryKeys.all, "alertas", { resolvido }] as const,
  cargosCatalog: () => [...hubQueryKeys.all, "cargos-catalog"] as const,
  ferramentasCustom: () => [...hubQueryKeys.all, "ferramentas-custom"] as const,
  ferramentasExternas: () => [...hubQueryKeys.all, "ferramentas-externas"] as const,
  integracoes: () => [...hubQueryKeys.all, "integracoes"] as const,
};

export function invalidateCargosCatalog(client: QueryClient) {
  return client.invalidateQueries({ queryKey: hubQueryKeys.cargosCatalog() });
}

export function invalidateHubAgentes(client: QueryClient) {
  return client.invalidateQueries({ queryKey: hubQueryKeys.agentes.all() });
}

export function invalidateHubAgente(client: QueryClient, slug: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: hubQueryKeys.agentes.detail(slug) }),
    client.invalidateQueries({ queryKey: hubQueryKeys.agentes.logs(slug) }),
    client.invalidateQueries({ queryKey: hubQueryKeys.agentes.operacao(slug) }),
  ]);
}

/** Actualiza uma linha no cache do catálogo (ex.: PATCH `ativo`). */
export function patchCargosCache(client: QueryClient, slug: string, patch: Partial<HubCargoCatalogRow>) {
  const norm = slug.trim();
  client.setQueryData<HubCargoCatalogRow[]>(hubQueryKeys.cargosCatalog(), (prev) => {
    if (!prev) return prev;
    return prev.map((row) =>
      String(row.slug ?? "").trim() === norm ? ({ ...row, ...patch } as HubCargoCatalogRow) : row
    );
  });
}

/** Actualiza várias linhas no cache (ex.: activar/desactivar em lote). */
export function patchCargosManyCache(client: QueryClient, updates: { slug: string; ativo: boolean }[]) {
  const map = new Map(updates.map((u) => [u.slug.trim(), u.ativo]));
  client.setQueryData<HubCargoCatalogRow[]>(hubQueryKeys.cargosCatalog(), (prev) => {
    if (!prev) return prev;
    return prev.map((row) => {
      const s = String(row.slug ?? "").trim();
      const ativo = map.get(s);
      return ativo !== undefined ? ({ ...row, ativo } as HubCargoCatalogRow) : row;
    });
  });
}
