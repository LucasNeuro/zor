"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { supabase } from "@/lib/supabase/client";
import {
  mergeLeadTimelineEvents,
  parseConversaTurnos,
  type LeadTimelineEvent,
} from "@/lib/crm/lead-timeline";
import { LeadActivityFlow } from "@/components/crm/leads/LeadActivityFlow";

type Theme = "light" | "dark";

type Props = {
  leadId: string;
  leadNome?: string;
  metadata?: unknown;
  theme?: Theme;
  compact?: boolean;
  className?: string;
  /** Eventos pré-carregados (evita fetch duplicado) */
  initialEvents?: LeadTimelineEvent[];
  /** Força re-sync quando o estágio ou timeline mudam */
  timelineKey?: string;
};

export function LeadTimelineTab({
  leadId,
  leadNome,
  metadata,
  theme = "light",
  compact = false,
  className = "",
  initialEvents,
  timelineKey,
}: Props) {
  const [events, setEvents] = useState<LeadTimelineEvent[]>(initialEvents ?? []);
  const [loading, setLoading] = useState(!initialEvents);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setErro("");

    try {
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        headers,
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && Array.isArray(json.timeline_events)) {
        setEvents(json.timeline_events as LeadTimelineEvent[]);
        return;
      }

      const [atividadesRes, mensagensRes, logsRes, encRes] = await Promise.all([
        supabase
          .from("hub_atividades")
          .select("*")
          .eq("lead_id", leadId)
          .order("criado_em", { ascending: false })
          .limit(80),
        supabase
          .from("hub_fila_mensagens")
          .select("id, direcao, conteudo, agente_responsavel, agente_id, remetente_numero, criado_em, enviada_em")
          .eq("lead_id", leadId)
          .order("criado_em", { ascending: false })
          .limit(40),
        supabase
          .from("hub_logs")
          .select("*")
          .eq("entidade", "lead")
          .eq("entidade_id", leadId)
          .order("criado_em", { ascending: false })
          .limit(30),
        supabase
          .from("hub_encaminhamentos")
          .select("*")
          .eq("lead_id", leadId)
          .order("criado_em", { ascending: false })
          .limit(20),
      ]);

      const meta = metadata ?? json.data?.metadata;
      const merged = mergeLeadTimelineEvents({
        atividades: atividadesRes.data ?? (json.timeline as Record<string, unknown>[]) ?? [],
        mensagens: mensagensRes.data ?? [],
        logs: logsRes.error ? [] : logsRes.data ?? [],
        encaminhamentos: encRes.error ? [] : encRes.data ?? [],
        conversaTurnos: parseConversaTurnos(meta),
      });

      setEvents(merged);
      if (!res.ok && !atividadesRes.data?.length) {
        setErro(typeof json.error === "string" ? json.error : "");
      }
    } catch {
      setErro("Erro ao carregar linha do tempo.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [leadId, metadata]);

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
      return;
    }
    void carregar();
  }, [carregar, initialEvents, timelineKey]);

  const flow = useMemo(
    () => (
      <LeadActivityFlow
        events={events}
        loading={loading}
        theme={theme}
        compact={compact}
        leadNome={leadNome}
        className={className}
      />
    ),
    [events, loading, theme, compact, leadNome, className]
  );

  if (erro && events.length === 0) {
    return (
      <div style={{ padding: compact ? 0 : 16 }}>
        <p style={{ fontSize: 12, color: "#b3261e", marginBottom: 12 }}>{erro}</p>
        {flow}
      </div>
    );
  }

  return flow;
}
