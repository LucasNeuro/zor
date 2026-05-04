"use client";

import { useState } from "react";
import {
  DECISIONS_MOCK, REVENUE_AT_RISK,
  sortDecisionsByPriority,
} from "@/lib/data/decisions-mock";
import DecisionCard from "./DecisionCard";

interface DecisionInboxProps {
  onVerAgente?: (agenteId: string) => void;
  onVerLead?: (leadId: string) => void;
  onVerParceiro?: (parceiroId: string) => void;
}

export default function DecisionInbox({ onVerAgente, onVerLead, onVerParceiro }: DecisionInboxProps) {
  const [filter, setFilter] = useState<"todos" | "critical" | "warning">("todos");
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const allDecisions = sortDecisionsByPriority(DECISIONS_MOCK).filter(
    (d) => !resolvedIds.includes(d.id)
  );
  const decisions = allDecisions.filter((d) =>
    filter === "todos" ? true : d.status === filter
  );
  const criticals = allDecisions.filter((d) => d.status === "critical");
  const warnings = allDecisions.filter((d) => d.status === "warning");

  function handleAction(decisionId: string, actionLabel: string) {
    if (actionLabel === "confirmado" || actionLabel === "Executar recomendação") {
      setResolvedIds((prev) => [...prev, decisionId]);
    }
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
          <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>R${(REVENUE_AT_RISK.total / 1000).toFixed(0)}k</span>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
          {REVENUE_AT_RISK.causas.map((c, i) => (
            <div key={i}>· {c.descricao} — R${(c.valor / 1000).toFixed(0)}k</div>
          ))}
        </div>
        <div style={{ marginTop: 5, fontSize: 9, color: "#22c55e", fontWeight: 600 }}>
          ↳ {REVENUE_AT_RISK.proxima_acao}
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
        {decisions.length === 0 ? (
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

      {/* Footer — pipeline de comissão */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[
          { label: "Comissão potencial", valor: REVENUE_AT_RISK.comissao_potencial, cor: "rgba(255,255,255,0.5)" },
          { label: "Comissão provável",  valor: REVENUE_AT_RISK.comissao_provavel,  cor: "#22c55e" },
          { label: "Confirmada",         valor: REVENUE_AT_RISK.comissao_confirmada, cor: "#22c55e" },
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
