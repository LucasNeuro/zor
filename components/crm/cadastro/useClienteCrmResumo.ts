"use client";

import { useCallback, useEffect, useState } from "react";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";
import type { ClienteCrmResumo } from "@/lib/crm/cliente-crm-resumo-types";

type Actor = { id?: string; email?: string; name?: string };

const EMPTY: ClienteCrmResumo = {
  leads: [],
  negocios: [],
  timeline_events: [],
};

export function useClienteCrmResumo(
  entity: "pessoa" | "empresa",
  entityId: string | null,
  actor: Actor,
  enabled: boolean
) {
  const [resumo, setResumo] = useState<ClienteCrmResumo>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!entityId || !enabled) {
      setResumo(EMPTY);
      return;
    }

    setLoading(true);
    setErro("");
    try {
      const base =
        entity === "pessoa"
          ? `/api/crm/pessoas/${encodeURIComponent(entityId)}/crm-resumo`
          : `/api/crm/empresas/${encodeURIComponent(entityId)}/crm-resumo`;

      const res = await fetch(base, {
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: ClienteCrmResumo;
        error?: string;
      };

      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar o resumo CRM.");
        setResumo(EMPTY);
        return;
      }

      setResumo(json.data ?? EMPTY);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
      setResumo(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [entity, entityId, enabled, actor.id, actor.email, actor.name]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { resumo, loading, erro, recarregar: carregar };
}
