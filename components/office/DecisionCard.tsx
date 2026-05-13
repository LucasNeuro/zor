"use client";

import { useState } from "react";
import { Decision, DecisionAction, getPriorityColor, getConfiancaLabel } from "@/lib/data/decisions-mock";

interface DecisionCardProps {
  decision: Decision;
  onAction: (decisionId: string, actionLabel: string) => void;
  onVerLead?: (leadId: string) => void;
  onVerParceiro?: (parceiroId: string) => void;
}

const STATUS_COLORS = {
  critical: { bg: "rgba(239,68,68,0.08)", border: "#ef4444", text: "#ef4444", label: "Crítico" },
  warning:  { bg: "rgba(234,179,8,0.08)",  border: "#eab308", text: "#eab308", label: "Atenção" },
  info:     { bg: "rgba(34,197,94,0.08)",  border: "#22c55e", text: "#22c55e", label: "Informativo" },
  system:   { bg: "rgba(96,165,250,0.08)", border: "#60a5fa", text: "#60a5fa", label: "Sistema" },
};

const CONFIANCA_COLORS: Record<string, string> = {
  alta: "#22c55e",
  media: "#eab308",
  baixa: "#ef4444",
};

const ACAO_COLORS = {
  primary:  { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.3)",  text: "#22c55e" },
  secondary:{ bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)",text: "rgba(255,255,255,0.7)" },
  danger:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  text: "#ef4444" },
  delegate: { bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)", text: "#60a5fa" },
};

export default function DecisionCard({ decision, onAction, onVerLead, onVerParceiro }: DecisionCardProps) {
  const [expanded, setExpanded] = useState(decision.status === "critical");
  const [confirmando, setConfirmando] = useState<{ texto: string; label: string } | null>(null);

  const sc = STATUS_COLORS[decision.status];
  const prioColor = getPriorityColor(decision.prioridade);

  function handleAcao(acao: DecisionAction) {
    if (acao.critica && acao.confirma_com) {
      setConfirmando({ texto: acao.confirma_com, label: acao.label });
    } else {
      onAction(decision.id, acao.label);
    }
  }

  return (
    <div style={{
      background: sc.bg,
      border: `1px solid ${sc.border}`,
      borderLeft: `3px solid ${sc.border}`,
      borderRadius: 8,
      marginBottom: 8,
      overflow: "hidden",
      transition: "all 200ms",
    }}>
      {/* Card header — always visible */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "10px 12px", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: sc.border, color: "white", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {sc.label}
            </span>
            <span style={{ fontSize: 9, color: prioColor, fontWeight: 600 }}>{decision.prioridade}/100</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: sc.text }}>{decision.impacto_label}</span>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "white", marginBottom: 3 }}>
          {decision.titulo}
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
          {decision.resumo.length > 80 ? decision.resumo.substring(0, 80) + "..." : decision.resumo}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: sc.text }}>⏱ {decision.tempo_atraso} atraso</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{decision.responsavel}</span>
            {decision.lead_id && onVerLead && (
              <button
                onClick={(e) => { e.stopPropagation(); onVerLead(decision.lead_id!); }}
                style={{ fontSize: 9, color: "#60a5fa", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Ver lead
              </button>
            )}
            {decision.parceiro_id && onVerParceiro && (
              <button
                onClick={(e) => { e.stopPropagation(); onVerParceiro(decision.parceiro_id!); }}
                style={{ fontSize: 9, color: "#a78bfa", background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Ver parceiro
              </button>
            )}
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>▼</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

          <div style={{ marginTop: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Causa provável</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{decision.causa_provavel}</div>
          </div>

          <div style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Recomendação da IA
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.4, marginBottom: 5 }}>
              {decision.recomendacao}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: CONFIANCA_COLORS[decision.confianca] }} />
              <span style={{ fontSize: 9, color: CONFIANCA_COLORS[decision.confianca], fontWeight: 600 }}>
                {getConfiancaLabel(decision.confianca)}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fontes dos dados</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {decision.fontes.map((fonte, i) => (
                <span key={i} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {fonte.nome} · {fonte.atualizadoHa}
                </span>
              ))}
            </div>
          </div>

          {confirmando ? (
            <div style={{ padding: "10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginBottom: 8, lineHeight: 1.4 }}>{confirmando.texto}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { onAction(decision.id, confirmando.label); setConfirmando(null); }} style={{ flex: 1, padding: "6px", borderRadius: 5, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  Confirmar
                </button>
                <button onClick={() => setConfirmando(null)} style={{ flex: 1, padding: "6px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {decision.acoes.map((acao, i) => {
                const ac = ACAO_COLORS[acao.tipo];
                return (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); handleAcao(acao); }}
                    style={{ padding: "6px 10px", borderRadius: 5, background: ac.bg, border: `1px solid ${ac.border}`, color: ac.text, fontSize: 11, cursor: "pointer", fontWeight: acao.tipo === "primary" ? 700 : 400, textAlign: "left", transition: "all 150ms" }}
                  >
                    {acao.label}
                    {acao.critica && <span style={{ fontSize: 8, opacity: 0.6, marginLeft: 4 }}>· requer confirmação</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
