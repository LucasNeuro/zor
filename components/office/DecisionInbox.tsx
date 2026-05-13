"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Decision, sortDecisionsByPriority } from "@/lib/data/decisions-mock";
import { supabase } from "@/lib/supabase/client";
import DecisionCard from "./DecisionCard";

interface DecisionInboxProps {
  onVerAgente?: (agenteId: string) => void;
  onVerLead?: (leadId: string) => void;
  onVerParceiro?: (parceiroId: string) => void;
}

function tempoDesde(data: string) {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(data).getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos}min`;
  if (minutos < 1440) return `${Math.round(minutos / 60)}h`;
  return `${Math.round(minutos / 1440)}d`;
}

export default function DecisionInbox({ onVerAgente, onVerLead, onVerParceiro }: DecisionInboxProps) {
  const [filter, setFilter] = useState<"todos" | "critical" | "warning">("todos");
  const [decisoes, setDecisoes] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [aprovacoes, alertas] = await Promise.all([
      supabase
        .from("hub_aprovacoes")
        .select("id, tipo, agente_slug, descricao, motivo, valor_envolvido, status, lead_id, criado_em")
        .eq("status", "pendente")
        .order("criado_em", { ascending: false })
        .limit(20),
      supabase
        .from("hub_alertas")
        .select("id, tipo, agente_slug, titulo, mensagem, dados, lead_id, criado_em")
        .eq("resolvido", false)
        .order("criado_em", { ascending: false })
        .limit(20),
    ]);

    const aprovacaoDecisions: Decision[] = (aprovacoes.data || []).map((item) => {
      const valor = Number(item.valor_envolvido) || 0;
      return {
        id: `aprovacao:${item.id}`,
        status: valor > 0 ? "critical" : "warning",
        titulo: item.tipo || "Aprovação pendente",
        resumo: item.descricao || item.motivo || "Aprovação aguardando decisão humana.",
        impacto_financeiro: valor,
        impacto_label: valor > 0 ? `R$${(valor / 1000).toFixed(0)}k em análise` : "Sem valor informado",
        tempo_atraso: tempoDesde(item.criado_em),
        sla_meta: "Decisão humana",
        responsavel: item.agente_slug || "IA",
        agente_id: item.agente_slug || "ia",
        area: "crm",
        causa_provavel: item.motivo || "Ação crítica bloqueada por governança.",
        recomendacao: item.descricao || "Revise a aprovação e confirme apenas se estiver alinhada à operação.",
        confianca: "media",
        fontes: [{ nome: "hub_aprovacoes", atualizadoHa: tempoDesde(item.criado_em) }],
        acoes: [
          { label: "Aprovar", tipo: "primary", critica: true, confirma_com: "Confirmar esta aprovação?" },
          { label: "Rejeitar", tipo: "danger", critica: true, confirma_com: "Rejeitar esta aprovação?" },
        ],
        prioridade: valor > 0 ? 90 : 65,
        lead_id: item.lead_id || undefined,
        criado_em: new Date(item.criado_em),
      };
    });

    const alertaDecisions: Decision[] = (alertas.data || []).map((item) => {
      const dados = (item.dados || {}) as Record<string, unknown>;
      const valor = Number(dados.valor_envolvido || dados.valor_estimado || dados.receita_em_risco) || 0;
      const critical = item.tipo === "critico";
      return {
        id: `alerta:${item.id}`,
        status: critical ? "critical" : "warning",
        titulo: item.titulo || "Alerta operacional",
        resumo: item.mensagem || "Alerta pendente no sistema.",
        impacto_financeiro: valor,
        impacto_label: valor > 0 ? `R$${(valor / 1000).toFixed(0)}k potencial` : "Sem valor informado",
        tempo_atraso: tempoDesde(item.criado_em),
        sla_meta: critical ? "Resolver agora" : "Acompanhar hoje",
        responsavel: item.agente_slug || "Sistema",
        agente_id: item.agente_slug || "sistema",
        area: "crm",
        causa_provavel: String(dados.causa || dados.motivo || "Condição operacional detectada automaticamente."),
        recomendacao: String(dados.recomendacao || "Resolver o alerta ou direcionar para o responsável."),
        confianca: critical ? "alta" : "media",
        fontes: [{ nome: "hub_alertas", atualizadoHa: tempoDesde(item.criado_em) }],
        acoes: [
          { label: "Marcar resolvido", tipo: "primary", critica: false, confirma_com: null },
          { label: "Ver agente", tipo: "secondary", critica: false, confirma_com: null },
        ],
        prioridade: critical ? 85 : 55,
        lead_id: item.lead_id || undefined,
        criado_em: new Date(item.criado_em),
      };
    });

    setDecisoes([...aprovacaoDecisions, ...alertaDecisions]);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel("decision-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_alertas" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregar]);

  const allDecisions = useMemo(() => sortDecisionsByPriority(decisoes), [decisoes]);
  const decisions = allDecisions.filter((d) =>
    filter === "todos" ? true : d.status === filter
  );
  const criticals = allDecisions.filter((d) => d.status === "critical");
  const warnings = allDecisions.filter((d) => d.status === "warning");
  const revenueAtRisk = allDecisions.reduce((total, d) => total + (d.impacto_financeiro || 0), 0);

  async function handleAction(decisionId: string, actionLabel: string) {
    const [source, id] = decisionId.split(":");
    if (!id) return;

    if (source === "aprovacao") {
      const status = actionLabel === "Rejeitar" ? "rejeitado" : "aprovado";
      await supabase
        .from("hub_aprovacoes")
        .update({ status, aprovado_por: "wendel", aprovado_em: new Date().toISOString() })
        .eq("id", id);
    }

    if (source === "alerta") {
      if (actionLabel === "Ver agente") {
        const decision = allDecisions.find((d) => d.id === decisionId);
        if (decision) onVerAgente?.(decision.agente_id);
        return;
      }
      await supabase
        .from("hub_alertas")
        .update({ resolvido: true, resolvido_em: new Date().toISOString() })
        .eq("id", id);
    }

    await carregar();
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "rgba(239,68,68,0.02)", overflow: "hidden" }}>

      {/* Panel label */}
      <div style={{
        padding: "8px 12px 6px", fontSize: 9, fontWeight: 700,
        color: "rgba(239,68,68,0.8)", textTransform: "uppercase", letterSpacing: "0.1em",
        borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>O que precisa de mim</span>
        {criticals.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10, background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
            {criticals.length} crítico{criticals.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Revenue at risk */}
      <div style={{ margin: "8px 12px 0", padding: "8px 10px", borderRadius: 7, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Receita em risco</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>{revenueAtRisk > 0 ? `R${(revenueAtRisk / 1000).toFixed(0)}k` : "A revisar"}</span>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
          {allDecisions.slice(0, 3).map((d) => (
            <div key={d.id}>· {d.titulo} — {d.impacto_financeiro > 0 ? `R${(d.impacto_financeiro / 1000).toFixed(0)}k` : d.status}</div>
          ))}
        </div>
        <div style={{ marginTop: 5, fontSize: 9, color: "#22c55e", fontWeight: 600 }}>
          ↳ {allDecisions[0]?.recomendacao || "Nenhuma decisão crítica pendente"}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, padding: "8px 12px 6px", flexShrink: 0 }}>
        {[
          { key: "todos",    label: `Todos (${allDecisions.length})` },
          { key: "critical", label: `Críticos (${criticals.length})` },
          { key: "warning",  label: `Atenção (${warnings.length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as "todos" | "critical" | "warning")}
            style={{
              flex: 1, padding: "4px 6px", borderRadius: 5, cursor: "pointer", transition: "all 150ms",
              background: filter === f.key ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f.key ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: filter === f.key ? "#ef4444" : "rgba(255,255,255,0.4)",
              fontSize: 9, fontWeight: filter === f.key ? 700 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Decision cards — scrollable */}
      <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px" }}>
        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            Carregando decisões reais...
          </div>
        ) : decisions.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Nenhuma decisão pendente</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>Operação saudável</div>
          </div>
        ) : (
          decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} onAction={handleAction} onVerLead={onVerLead} onVerParceiro={onVerParceiro} />
          ))
        )}
      </div>

      {/* Footer — resumo financeiro real das decisões carregadas */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[
          { label: "Valor pendente", valor: revenueAtRisk, cor: "rgba(255,255,255,0.5)" },
          { label: "Críticos", valor: criticals.reduce((sum, item) => sum + item.impacto_financeiro, 0), cor: "#ef4444" },
          { label: "Atenção", valor: warnings.reduce((sum, item) => sum + item.impacto_financeiro, 0), cor: "#eab308" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{item.label}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: item.cor }}>R${(item.valor / 1000).toFixed(0)}k</span>
          </div>
        ))}
      </div>

    </div>
  );
}
