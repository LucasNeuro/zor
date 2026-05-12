"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";

const REALTIME_METRICAS =
  typeof process.env.NEXT_PUBLIC_ENABLE_REALTIME_METRICAS === "string"
    ? process.env.NEXT_PUBLIC_ENABLE_REALTIME_METRICAS !== "false"
    : true;

function inicioDiaLocalISO(): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje.toISOString();
}

export interface Metricas {
  leadsHoje: number;
  leadsAguardando: number;
  aprovacoesPendentes: number;
  conversasAtivas: number;
  agentesAtivos: number;
  receitaPotencial: number;
  parceirosAtivos: number;
  encaminhamentosHoje: number;
  taxaQualificacao: number;
  taxaEncaminhamento: number;
  loading: boolean;
}

const inicial: Metricas = {
  leadsHoje: 0,
  leadsAguardando: 0,
  aprovacoesPendentes: 0,
  conversasAtivas: 0,
  agentesAtivos: 0,
  receitaPotencial: 0,
  parceirosAtivos: 0,
  encaminhamentosHoje: 0,
  taxaQualificacao: 0,
  taxaEncaminhamento: 0,
  loading: true,
};

const DEBOUNCE_MS = 400;

export function useMetricas() {
  const [metricas, setMetricas] = useState<Metricas>(inicial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const since = inicioDiaLocalISO();
    const res = await fetch(`/api/crm/metricas?since=${encodeURIComponent(since)}`, {
      headers: { ...internalApiHeaders() },
    });
    if (!res.ok) {
      setMetricas(prev => ({ ...prev, loading: false }));
      return;
    }
    const body = (await res.json()) as Omit<Metricas, "loading">;
    setMetricas({
      ...body,
      loading: false,
    });
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

    let sub: ReturnType<typeof supabase.channel> | null = null;
    if (REALTIME_METRICAS) {
      sub = supabase
        .channel("metricas-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_encaminhamentos" }, agendarRecarregar)
        .on("postgres_changes", { event: "*", schema: "public", table: "hub_profissionais" }, agendarRecarregar)
        .subscribe();
    }

    const intervalMs = REALTIME_METRICAS ? 60000 : 120000;
    const interval = setInterval(() => void carregar(), intervalMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (sub) supabase.removeChannel(sub);
      clearInterval(interval);
    };
  }, [carregar, agendarRecarregar]);

  return metricas;
}
