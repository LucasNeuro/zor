"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformBrandRow } from "@/components/crm/waje/WajeOwnerPlataformaSideover";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export function useWajePlataformaBrands() {
  const [rows, setRows] = useState<PlatformBrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/ops/platform-brands", {
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const raw = await res.text();
      let json: { data?: PlatformBrandRow[]; error?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Resposta inválida do servidor."
            : `Falha ao carregar (${res.status}). Confirme que executou ensure_hub_platform_brands.sql no Supabase.`
        );
      }
      if (!res.ok) throw new Error(json.error ?? `Falha ao carregar (${res.status}).`);
      setRows(json.data ?? []);
    } catch (e) {
      setRows([]);
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { rows, setRows, loading: loading && !hasLoadedOnce, refreshing, erro, carregar };
}
