"use client";

import { useCallback, useEffect, useState } from "react";
import { crmFetch } from "@/lib/internal-api-headers-client";
import type { FinanceDashboardPayload } from "@/lib/crm/finance-dashboard-aggregate";
import { aggregateFinanceDashboard } from "@/lib/crm/finance-dashboard-aggregate";
import { DEFAULT_OBRA10_TENANT_ID } from "@/lib/tenant-default";
import { supabase } from "@/lib/supabase/client";

export type FinanceDashboardState = FinanceDashboardPayload & {
  loading: boolean;
  erro: string | null;
  carregado: boolean;
  recarregar: () => void;
};

const inicial: FinanceDashboardState = {
  kpis: {
    aPagarAberto: 0,
    aReceberAberto: 0,
    vencidoTotal: 0,
    vencidoPagar: 0,
    vencidoReceber: 0,
    saldoProjetado: 0,
    vence7dTotal: 0,
    vence7dCount: 0,
  },
  acao: [],
  aprovacoes: [],
  pipeline: {
    receitaPotencialLeads: 0,
    receitaPotencialNegocios: 0,
    negociosSitDown: 0,
  },
  proximosVencimentos: [],
  loading: true,
  erro: null,
  carregado: false,
  recarregar: () => {},
};

function tenantIdCliente(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_ID?.trim();
  return fromEnv || DEFAULT_OBRA10_TENANT_ID;
}

export function useFinanceDashboard(): FinanceDashboardState {
  const [state, setState] = useState<FinanceDashboardState>(inicial);

  const carregar = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, erro: null }));
    try {
      const res = await crmFetch("/api/crm/financeiro/dashboard", { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as FinanceDashboardPayload;
        setState({
          ...body,
          loading: false,
          erro: null,
          carregado: true,
          recarregar: carregar,
        });
        return;
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        typeof errBody.error === "string" ? errBody.error : `Erro ${res.status}`
      );
    } catch (apiErr) {
      try {
        const body = await aggregateFinanceDashboard(supabase, tenantIdCliente());
        setState({
          ...body,
          loading: false,
          erro:
            apiErr instanceof Error
              ? `${apiErr.message} (dados via Supabase)`
              : null,
          carregado: true,
          recarregar: carregar,
        });
      } catch (fallbackErr) {
        setState((s) => ({
          ...s,
          loading: false,
          erro:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : "Não foi possível carregar o painel financeiro",
          carregado: false,
          recarregar: carregar,
        }));
      }
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { ...state, recarregar: carregar };
}
