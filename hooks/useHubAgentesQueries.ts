"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import {
  detailQueryDefaults,
  listQueryDefaults,
  operacaoQueryDefaults,
} from "@/lib/crm/query-config";
import {
  hubQueryKeys,
  type HubAgentesListMode,
  invalidateHubAgente,
  invalidateHubAgentes,
} from "@/lib/hub/hub-query-keys";

export type HubAgenteRow = {
  agente_slug: string;
  nome: string;
  cargo: string;
  area?: string;
  segmento?: string;
  nivel?: string;
  ativo?: boolean;
  arquivado_em?: string | null;
  avatar_url?: string | null;
  prefixo_mercado?: string;
  bio?: string;
  tom_voz?: string;
  estilo_comunicacao?: string;
  system_prompt_base?: string;
  modelo_padrao?: string;
  [key: string]: unknown;
};

export type HubAgenteLogRow = {
  id: string;
  criado_em?: string;
  mensagem_usuario?: string;
  resposta_ia?: string;
  modelo_usado?: string;
  tempo_resposta_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
  custo_estimado_brl?: number;
  [key: string]: unknown;
};

export type HubAgenteOperacaoPayload = {
  ciclos: Record<string, unknown>[];
  execucoes_ciclo: Record<string, unknown>[];
  acoes: Record<string, unknown>[];
  ultimo_prompt_em: string | null;
};

function urlParaModo(modo: HubAgentesListMode): string {
  if (modo === "todos") return "/api/hub/agentes?todos=true";
  if (modo === "arquivados") return "/api/hub/agentes?arquivados=somente";
  if (modo === "inativos") return "/api/hub/agentes?ativo=false";
  return "/api/hub/agentes?ativo=true";
}

async function fetchHubAgentesList(modo: HubAgentesListMode): Promise<HubAgenteRow[]> {
  const res = await fetch(urlParaModo(modo), { headers: await crmApiHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Erro ${res.status} ao carregar agentes.`);
  }
  if (Array.isArray(data)) return data as HubAgenteRow[];
  if (Array.isArray(data?.agentes)) return data.agentes as HubAgenteRow[];
  throw new Error("Resposta inesperada do servidor.");
}

export async function fetchHubAgenteDetail(slug: string): Promise<HubAgenteRow> {
  const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}`, {
    headers: await crmApiHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Falha ao carregar agente.");
  }
  return data as HubAgenteRow;
}

async function fetchHubAgenteLogs(slug: string): Promise<HubAgenteLogRow[]> {
  const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/logs?limit=80`, {
    headers: await crmApiHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Falha ao carregar logs.");
  }
  return Array.isArray(data?.logs) ? (data.logs as HubAgenteLogRow[]) : [];
}

async function fetchHubAgenteOperacao(slug: string): Promise<HubAgenteOperacaoPayload> {
  const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/operacao`, {
    headers: await crmApiHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Falha ao carregar dados operacionais.");
  }
  return {
    ciclos: Array.isArray(data?.ciclos) ? data.ciclos : [],
    execucoes_ciclo: Array.isArray(data?.execucoes_ciclo) ? data.execucoes_ciclo : [],
    acoes: Array.isArray(data?.acoes) ? data.acoes : [],
    ultimo_prompt_em: typeof data?.ultimo_prompt_em === "string" ? data.ultimo_prompt_em : null,
  };
}

export function prefetchHubAgentesList(qc: QueryClient, modo: HubAgentesListMode = "todos") {
  return qc.prefetchQuery({
    queryKey: hubQueryKeys.agentes.list(modo),
    queryFn: () => fetchHubAgentesList(modo),
    ...listQueryDefaults,
  });
}

export function prefetchHubAgenteDetail(qc: QueryClient, slug: string) {
  return qc.prefetchQuery({
    queryKey: hubQueryKeys.agentes.detail(slug),
    queryFn: () => fetchHubAgenteDetail(slug),
    ...detailQueryDefaults,
  });
}

export function useHubAgentesList(modo: HubAgentesListMode) {
  return useQuery({
    queryKey: hubQueryKeys.agentes.list(modo),
    queryFn: () => fetchHubAgentesList(modo),
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useHubAgenteDetail(slug: string | null) {
  return useQuery({
    queryKey: hubQueryKeys.agentes.detail(slug ?? ""),
    queryFn: () => fetchHubAgenteDetail(slug!),
    enabled: !!slug,
    ...detailQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useHubAgenteLogs(slug: string | null) {
  return useQuery({
    queryKey: hubQueryKeys.agentes.logs(slug ?? ""),
    queryFn: () => fetchHubAgenteLogs(slug!),
    enabled: !!slug,
    ...detailQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useHubAgenteOperacao(slug: string | null, options?: { live?: boolean }) {
  const live = options?.live === true && !!slug;
  return useQuery({
    queryKey: hubQueryKeys.agentes.operacao(slug ?? ""),
    queryFn: () => fetchHubAgenteOperacao(slug!),
    enabled: !!slug,
    ...operacaoQueryDefaults,
    refetchInterval: live ? 15_000 : false,
    refetchOnWindowFocus: live,
    placeholderData: (prev) => prev,
  });
}

const LIST_MODES: HubAgentesListMode[] = ["todos", "ativos", "inativos", "arquivados"];

export function patchHubAgenteDetailCache(qc: QueryClient, slug: string, data: HubAgenteRow) {
  qc.setQueryData(hubQueryKeys.agentes.detail(slug), data);
}

export function patchHubAgenteInLists(
  qc: QueryClient,
  slug: string,
  patch: Partial<HubAgenteRow> | ((row: HubAgenteRow) => HubAgenteRow | null)
) {
  for (const modo of LIST_MODES) {
    qc.setQueryData<HubAgenteRow[]>(hubQueryKeys.agentes.list(modo), (prev) => {
      if (!prev) return prev;
      return prev
        .map((row) => {
          if (row.agente_slug !== slug) return row;
          if (typeof patch === "function") return patch(row);
          return { ...row, ...patch };
        })
        .filter((row): row is HubAgenteRow => row !== null);
    });
  }
}

export function removeHubAgenteFromCaches(qc: QueryClient, slug: string) {
  for (const modo of LIST_MODES) {
    qc.setQueryData<HubAgenteRow[]>(hubQueryKeys.agentes.list(modo), (prev) =>
      prev ? prev.filter((a) => a.agente_slug !== slug) : prev
    );
  }
  qc.removeQueries({ queryKey: hubQueryKeys.agentes.detail(slug) });
  qc.removeQueries({ queryKey: hubQueryKeys.agentes.logs(slug) });
  qc.removeQueries({ queryKey: hubQueryKeys.agentes.operacao(slug) });
}

export { invalidateHubAgentes, invalidateHubAgente };
