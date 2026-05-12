"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export interface CargoAgente {
  cargo: string;
  area: string;
  mercados?: string[];
  ativo: boolean;
}

export interface Agente {
  id: string;
  agente_slug: string;
  nome: string;
  cargo: string;
  area: string;
  nivel: number;
  cargos: CargoAgente[];
  bio?: string;
  foto_url?: string;
  ativo: boolean;
  modelo_padrao: string;
  pode_fazer: string[];
  nao_pode_fazer: string[];
  prefixo_mercado: string;
}

export function useAgentes() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("hub_agente_identidade")
      .select("*")
      .eq("ativo", true)
      .order("nivel");
    if (data) setAgentes(data as Agente[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase
      .channel("agentes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_agente_identidade" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar]);

  return { agentes, loading, recarregar: carregar };
}
