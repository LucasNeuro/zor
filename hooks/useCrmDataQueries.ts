"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { crmQueryKeys, type CrmNegociosFiltros } from "@/lib/crm/crm-query-keys";
import { listQueryDefaults, ciclosListQueryDefaults } from "@/lib/crm/query-config";
import { hubQueryKeys } from "@/lib/hub/hub-query-keys";

export type CrmPipelineRow = {
  id: string;
  slug: string;
  nome: string;
  tipo: string;
  mercado_sigla?: string | null;
  estagios?: {
    slug: string;
    label: string;
    cor?: string;
    ordem: number;
    ativo?: boolean;
    sistema?: boolean;
  }[];
};

export type CrmNegociosPage = {
  data: Record<string, unknown>[];
  total: number;
};

export type CrmPipelineTipo = "lead" | "negocio" | "atendimento";

async function fetchCrmPipelines(tipo: CrmPipelineTipo): Promise<CrmPipelineRow[]> {
  const res = await fetch(`/api/crm/pipelines?tipo=${tipo}`, { headers: internalApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Falha ao carregar pipelines.");
  return (json.data || []) as CrmPipelineRow[];
}

async function fetchCrmNegociosPage(f: CrmNegociosFiltros): Promise<CrmNegociosPage> {
  const p = new URLSearchParams({ offset: String(f.offset ?? 0) });
  if (f.busca) p.set("busca", f.busca);
  if (f.etapa) p.set("etapa", f.etapa);
  if (f.pipelineId) p.set("pipeline_id", f.pipelineId);
  const res = await fetch(`/api/crm/negocios?${p}`, { headers: internalApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Falha ao carregar negócios.");
  return { data: json.data ?? [], total: json.total ?? 0 };
}

async function fetchHubCiclosList(): Promise<Record<string, unknown>[]> {
  const res = await fetch("/api/hub/ciclos", { headers: internalApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Falha ao carregar ciclos.");
  return Array.isArray(json?.ciclos) ? json.ciclos : [];
}

export function prefetchCrmPipelines(qc: QueryClient, tipo: CrmPipelineTipo) {
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.pipelines(tipo),
    queryFn: () => fetchCrmPipelines(tipo),
    ...listQueryDefaults,
  });
}

export function prefetchCrmNegociosList(qc: QueryClient, filtros: CrmNegociosFiltros = {}) {
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.negocios(filtros),
    queryFn: () => fetchCrmNegociosPage(filtros),
    ...listQueryDefaults,
  });
}

export function prefetchHubCiclosList(qc: QueryClient) {
  return qc.prefetchQuery({
    queryKey: hubQueryKeys.ciclos.list(),
    queryFn: fetchHubCiclosList,
    ...ciclosListQueryDefaults,
  });
}

export function useCrmPipelines(tipo: CrmPipelineTipo, enabled = true) {
  return useQuery({
    queryKey: crmQueryKeys.pipelines(tipo),
    queryFn: () => fetchCrmPipelines(tipo),
    enabled,
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useCrmNegociosList(filtros: CrmNegociosFiltros, enabled = true) {
  return useQuery({
    queryKey: crmQueryKeys.negocios(filtros),
    queryFn: () => fetchCrmNegociosPage(filtros),
    enabled,
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useHubCiclosList(enabled = true) {
  return useQuery({
    queryKey: hubQueryKeys.ciclos.list(),
    queryFn: fetchHubCiclosList,
    enabled,
    ...ciclosListQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function invalidateHubCiclosList(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: hubQueryKeys.ciclos.list() });
}
