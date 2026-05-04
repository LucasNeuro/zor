"use client";

import { useState } from "react";

export interface CriticalActionModalProps {
  titulo: string;
  contexto: string;
  impacto_financeiro?: number;
  impacto_label?: string;
  riscos: string[];
  alternativas: { id: string; label: string; descricao: string }[];
  recomendacao_ia: string;
  confianca_ia: number;
  fontes?: string[];
  onConfirm: (justificativa: string, alternativaSelecionada?: string) => void;
  onDelegate?: () => void;
  onCancel: () => void;
}

export default function CriticalActionModal({
  titulo,
  contexto,
  impacto_financeiro,
  impacto_label,
  riscos,
  alternativas,
  recomendacao_ia,
  confianca_ia,
  fontes,
  onConfirm,
  onDelegate,
  onCancel,
}: CriticalActionModalProps) {
  const [justificativa, setJustificativa] = useState("");
  const [alternativaSelecionada, setAlternativaSelecionada] = useState<string | undefined>(undefined);
  const [confirmando, setConfirmando] = useState(false);

  const confiancaColor = confianca_ia >= 85 ? "#22c55e" : confianca_ia >= 65 ? "#eab308" : "#ef4444";

  function handleConfirm() {
    if (confirmando) {
      onConfirm(justificativa, alternativaSelecionada);
    } else {
      setConfirmando(true);
    }
  }

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 2000 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "min(520px, calc(100vw - 32px))",
        maxHeight: "calc(100vh - 64px)",
        background: "#0d1420",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 12,
        zIndex: 2001,
        display: "flex", flexDirection: "column",
        animation: "scaleIn 200ms ease",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(239,68,68,0.15)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(239,68,68,0.15)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ação Crítica</span>
            <button
              onClick={onCancel}
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: 0 }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", marginBottom: 3 }}>{titulo}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{contexto}</div>
        </div>

        {/* Scrollable body */}
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Financial impact */}
          {impacto_financeiro != null && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Impacto Financeiro</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>R${impacto_financeiro.toLocaleString("pt-BR")}</div>
              {impacto_label && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{impacto_label}</div>}
            </div>
          )}

          {/* Risks */}
          {riscos.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Riscos</div>
              {riscos.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ color: "#f97316", fontSize: 10, flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Alternatives */}
          {alternativas.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Alternativas</div>
              {alternativas.map((alt) => {
                const isSelected = alternativaSelecionada === alt.id;
                return (
                  <div
                    key={alt.id}
                    onClick={() => setAlternativaSelecionada(isSelected ? undefined : alt.id)}
                    style={{
                      padding: "8px 10px", borderRadius: 7, marginBottom: 5, cursor: "pointer",
                      background: isSelected ? "rgba(96,165,250,0.1)" : "rgba(255,255,255,0.02)",
                      border: isSelected ? "1px solid rgba(96,165,250,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      transition: "all 150ms",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "#60a5fa" : "#f8fafc", marginBottom: 2 }}>{alt.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{alt.descricao}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI recommendation */}
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10 }}>🤖</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recomendação IA</span>
              <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: confiancaColor }}>{confianca_ia}% confiança</span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, margin: 0 }}>{recomendacao_ia}</p>
          </div>

          {/* Sources */}
          {fontes && fontes.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Fontes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {fontes.map((f) => (
                  <span key={f} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Justification */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Justificativa <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>(opcional)</span>
            </div>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo desta decisão para o histórico de auditoria..."
              style={{
                width: "100%", minHeight: 72, padding: "8px 10px", borderRadius: 7,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.75)", fontSize: 11, lineHeight: 1.5,
                resize: "vertical", outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)",
            }}
          >
            Cancelar
          </button>
          {onDelegate && (
            <button
              onClick={onDelegate}
              style={{
                padding: "8px 16px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308",
              }}
            >
              Delegar
            </button>
          )}
          <button
            onClick={handleConfirm}
            style={{
              padding: "8px 18px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: confirmando ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: confirmando ? "#fff" : "#ef4444",
              transition: "all 200ms",
            }}
          >
            {confirmando ? "Confirmar mesmo assim" : "Confirmar ação"}
          </button>
        </div>
      </div>
    </>
  );
}
