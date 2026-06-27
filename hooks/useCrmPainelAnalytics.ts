"use client";

import { useCallback, useEffect, useState } from "react";
import { crmFetch } from "@/lib/internal-api-headers-client";
import type { AnalyticsPayload } from "@/lib/crm/analytics-aggregate";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";

export function useCrmPainelAnalytics(periodo: AnalyticsPeriodo) {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await crmFetch(
        `/api/crm/analytics?periodo=${periodo}&mercado=${MERCADO_PREFIXO_PADRAO}`
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as AnalyticsPayload);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar gráficos");
      setData(null);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { data, carregando, erro, recarregar: carregar };
}
