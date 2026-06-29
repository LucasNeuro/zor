"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { crmFetch } from "@/lib/internal-api-headers-client";
import type {
  AlertaResumo,
  CicloStatus,
  CrmMetricas,
  DashboardPayload,
  LeadRecente,
  OperacaoResumo,
} from "@/lib/crm/dashboard-aggregate";
import { aggregateDashboard } from "@/lib/crm/dashboard-aggregate";
import { DEFAULT_OBRA10_TENANT_ID } from "@/lib/tenant-default";
import { supabase } from "@/lib/supabase/client";

export type { AlertaResumo, CicloStatus, LeadRecente, OperacaoResumo };

const REALTIME_METRICAS =
  typeof process.env.NEXT_PUBLIC_ENABLE_REALTIME_METRICAS === "string"
    ? process.env.NEXT_PUBLIC_ENABLE_REALTIME_METRICAS !== "false"
    : true;

function inicioDiaLocalISO(): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje.toISOString();
}

export type CrmDashboardState = CrmMetricas & {
  alertas: AlertaResumo[];
  leadsRecentes: LeadRecente[];
  ciclos: CicloStatus[];
  operacao: OperacaoResumo;
  loading: boolean;
  erro: string | null;
  /** true quando os dados vieram da API ou de fallback Supabase no browser */
  carregado: boolean;
  recarregar: () => void;
};

const inicial: CrmDashboardState = {
  leadsHoje: 0,
  leadsAguardando: 0,
  aprovacoesPendentes: 0,
  mensagensFilaPendentes: 0,
  agentesAtivos: 0,
  receitaPotencial: 0,
  parceirosAtivos: 0,
  encaminhamentosHoje: 0,
  taxaQualificacao: 0,
  taxaEncaminhamento: 0,
  alertas: [],
  leadsRecentes: [],
  ciclos: [],
  operacao: { negociosAbertos: 0, conversasAtivas: 0, leadsAtivos: 0 },
  loading: true,
  erro: null,
  carregado: false,
  recarregar: () => {},
};

function tenantIdCliente(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_ID?.trim();
  return fromEnv || DEFAULT_OBRA10_TENANT_ID;
}

function aplicarPayload(
  prev: CrmDashboardState,
  body: DashboardPayload
): CrmDashboardState {
  return {
    ...prev,
    ...body,
    loading: false,
    erro: null,
    carregado: true,
  };
}

const DEBOUNCE_MS = 400;

export function useCrmDashboard(): CrmDashboardState {
  const [state, setState] = useState<CrmDashboardState>(inicial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const since = inicioDiaLocalISO();
    const res = await crmFetch(`/api/crm/dashboard?since=${encodeURIComponent(since)}`);
    if (res.ok) {
      const body = (await res.json()) as DashboardPayload;
      setState((prev) => aplicarPayload(prev, body));
      return;
    }

    try {
      const body = await aggregateDashboard(supabase, tenantIdCliente(), since);
      setState((prev) => aplicarPayload(prev, body));
      return;
    } catch {
      /* fallback client falhou também */
    }

    setState((prev) => ({
      ...prev,
      loading: false,
      erro: prev.carregado
        ? "Não foi possível atualizar o painel. Os dados abaixo podem estar desatualizados."
        : "Não foi possível carregar o painel. Tente atualizar a página.",
    }));
  }, []);

  const agendarRecarregar = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void carregar();
    }, DEBOUNCE_MS);
  }, [carregar]);

  useEffect(() => {
    void carregar();

    let subMetricas: ReturnType<typeof supabase.channel> | null = null;
    if (REALTIME_METRICAS) {
      subMetricas = supabase
        .channel("crm-dashboard-metricas")
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_encaminhamentos" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_profissionais" }, agendarRecarregar)
        .subscribe();
    }

    const chResumo = supabase
      .channel("crm-dashboard-resumo")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_alertas" }, agendarRecarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_negocios" }, agendarRecarregar)
      .subscribe();

    const intervalMs = REALTIME_METRICAS ? 60000 : 120000;
    const interval = setInterval(() => void carregar(), intervalMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (subMetricas) supabase.removeChannel(subMetricas);
      supabase.removeChannel(chResumo);
      clearInterval(interval);
    };
  }, [carregar, agendarRecarregar]);

  return { ...state, recarregar: () => void carregar() };
}
