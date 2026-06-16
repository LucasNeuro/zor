"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  crmQueryKeys,
  type CrmEmpresasFiltros,
  type CrmPessoasFiltros,
} from "@/lib/crm/crm-query-keys";

import { CRM_LIST_LIMIT } from "@/lib/crm/crm-list-config";

import { listQueryDefaults } from "@/lib/crm/query-config";
import { CRM_MODULE_PARCEIROS_ENABLED } from "@/lib/crm/waje-modules";

async function fetchJsonList<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { headers: internalApiHeaders() });
  const data = (await res.json().catch(() => ({}))) as { data?: T[]; erro?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.erro || data.error || "Falha ao carregar lista.");
  }
  return data.data ?? [];
}

function buildPessoasUrl(f: CrmPessoasFiltros): string {
  const q = new URLSearchParams({ offset: "0", limit: "500" });
  if (f.busca) q.set("busca", f.busca);
  if (f.tipo_pessoa) q.set("tipo_pessoa", f.tipo_pessoa);
  if (f.estado) q.set("estado", f.estado);
  if (f.origem) q.set("origem", f.origem);
  if (f.area_atuacao) q.set("area_atuacao", f.area_atuacao);
  return `/api/crm/pessoas?${q}`;
}

function buildEmpresasUrl(f: CrmEmpresasFiltros): string {
  const q = new URLSearchParams({ offset: "0", limit: String(CRM_LIST_LIMIT) });
  if (f.busca) q.set("busca", f.busca);
  if (f.segmento) q.set("segmento", f.segmento);
  if (f.prefixo_mercado) q.set("prefixo_mercado", f.prefixo_mercado);
  if (f.estado) q.set("estado", f.estado);
  if (f.ativo !== undefined && f.ativo !== "") q.set("ativo", f.ativo);
  return `/api/crm/empresas?${q}`;
}

export type ParceiroListaRow = {
  id: string;
  codigo?: string | null;
  nome: string;
  telefone: string;
  email: string | null;
  especialidade: string | null;
  mercado: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  modulo_atual: number;
  recebe_leads: boolean;
  total_leads_recebidos: number;
  total_leads_convertidos: number;
  comissao_pct: number;
  criado_em: string;
  hub_parceiros_captacao: { estagio: string; origem: string | null } | null;
  hub_parceiros_homologacao: {
    estagio: string;
    modulos_concluidos: number;
    data_conclusao: string | null;
  } | null;
  /** Opcional — listagem não carrega módulos (performance). */
  hub_parceiros_modulos?: {
    modulo_numero: number;
    status: string;
    concluido_em: string | null;
  }[];
};

export async function fetchCrmParceirosList(): Promise<ParceiroListaRow[]> {
  if (!CRM_MODULE_PARCEIROS_ENABLED) return [];
  const res = await fetch("/api/parceiros", { headers: internalApiHeaders() });
  const data = (await res.json().catch(() => ({}))) as {
    parceiros?: ParceiroListaRow[];
    erro?: string;
  };
  if (!res.ok) throw new Error(data.erro || "Falha ao carregar parceiros.");
  return data.parceiros ?? [];
}

export function prefetchCrmPessoasList(qc: QueryClient, filtros: CrmPessoasFiltros = {}) {
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.pessoas(filtros),
    queryFn: () => fetchJsonList(buildPessoasUrl(filtros)),
    ...listQueryDefaults,
  });
}

export function prefetchCrmEmpresasList(qc: QueryClient, filtros: CrmEmpresasFiltros = {}) {
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.empresas(filtros),
    queryFn: () => fetchJsonList(buildEmpresasUrl(filtros)),
    ...listQueryDefaults,
  });
}

export function prefetchCrmParceirosList(qc: QueryClient) {
  if (!CRM_MODULE_PARCEIROS_ENABLED) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: crmQueryKeys.parceiros(),
    queryFn: fetchCrmParceirosList,
    ...listQueryDefaults,
  });
}

export function useCrmPessoasList(filtros: CrmPessoasFiltros, enabled = true) {
  return useQuery({
    queryKey: crmQueryKeys.pessoas(filtros),
    queryFn: () => fetchJsonList<Record<string, unknown>>(buildPessoasUrl(filtros)),
    enabled,
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useCrmEmpresasList(filtros: CrmEmpresasFiltros, enabled = true) {
  return useQuery({
    queryKey: crmQueryKeys.empresas(filtros),
    queryFn: () => fetchJsonList<Record<string, unknown>>(buildEmpresasUrl(filtros)),
    enabled,
    ...listQueryDefaults,
    placeholderData: (prev) => prev,
  });
}

export function useCrmParceirosList(enabled = CRM_MODULE_PARCEIROS_ENABLED) {
  return useQuery({
    queryKey: crmQueryKeys.parceiros(),
    queryFn: fetchCrmParceirosList,
    enabled: CRM_MODULE_PARCEIROS_ENABLED && enabled,
    ...listQueryDefaults,
    placeholderData: (prev: ParceiroListaRow[] | undefined) => prev,
  });
}
