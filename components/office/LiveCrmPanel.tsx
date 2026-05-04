"use client";

import { LiveLead, PHASE_CONFIG } from "@/lib/data/live-leads";

interface LiveCrmPanelProps {
  leads: LiveLead[];
  onLeadClick: (lead: LiveLead) => void;
  onAvancarFase: (leadId: string) => void;
}

function tempoLabel(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h`;
}

export default function LiveCrmPanel({ leads, onLeadClick, onAvancarFase }: LiveCrmPanelProps) {
  const criticos = leads.filter((l) => l.fase === "critico");
  const ativos = leads.filter((l) => !["critico", "saindo", "frio"].includes(l.fase));
  const frios = leads.filter((l) => l.fase === "frio");

  const porFase = {
    aguardando:     leads.filter((l) => l.fase === "aguardando").length,
    triagem:        leads.filter((l) => l.fase === "triagem").length,
    qualificando:   leads.filter((l) => l.fase === "qualificando").length,
    qualificado:    leads.filter((l) => l.fase === "qualificado").length,
    match_realizado: leads.filter((l) => l.fase === "match_realizado").length,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header CRM */}
      <div style={{
        padding: "8px 12px 6px",
        fontSize: 9, fontWeight: 700,
        color: "rgba(34,197,94,0.8)",
        textTransform: "uppercase", letterSpacing: "0.1em",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>CRM ao vivo</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#22c55e" }}>{leads.length} leads</span>
        </div>
      </div>

      {/* Supervisão — Ger. Atendimento */}
      <div style={{
        padding: "6px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(168,85,247,0.04)",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 8, color: "rgba(168,85,247,0.7)", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
        }}>
          👁️ Supervisão — Ger. Atendimento
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          Monitorando qualidade do atendimento
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {[
            { label: "SLA médio", valor: "8min", meta: "5min", ok: false },
            { label: "Qualif.",   valor: "38%",  meta: "45%",  ok: false },
            { label: "Contato",   valor: "93%",  meta: "90%",  ok: true  },
            { label: "NPS",       valor: "8.2",  meta: "7.0",  ok: true  },
          ].map((m, i) => (
            <div key={i} style={{
              padding: "4px 6px", borderRadius: 5,
              background: m.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${m.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`,
            }}>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)" }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.ok ? "#22c55e" : "#ef4444" }}>{m.valor}</div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)" }}>meta {m.meta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Funil visual compacto */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {[
            { label: "Fila",    count: porFase.aguardando,     cor: "#fbbf24" },
            { label: "Triagem", count: porFase.triagem,        cor: "#60a5fa" },
            { label: "SDR",     count: porFase.qualificando,   cor: "#60a5fa" },
            { label: "Qualif.", count: porFase.qualificado,    cor: "#22c55e" },
            { label: "Match",   count: porFase.match_realizado,cor: "#22c55e" },
          ].map((item, i) => (
            <div key={i} style={{
              textAlign: "center", padding: "5px 4px", borderRadius: 6,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.count > 0 ? item.cor : "rgba(255,255,255,0.2)" }}>
                {item.count}
              </div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de leads */}
      <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>

        {criticos.length > 0 && (
          <div>
            <div style={{ padding: "6px 12px 4px", fontSize: 8, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              🔴 Críticos ({criticos.length})
            </div>
            {criticos.map((lead) => (
              <LeadCrmCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} onAvancar={() => onAvancarFase(lead.id)} />
            ))}
          </div>
        )}

        {ativos.length > 0 && (
          <div>
            <div style={{ padding: "6px 12px 4px", fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Em andamento ({ativos.length})
            </div>
            {ativos.map((lead) => (
              <LeadCrmCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} onAvancar={() => onAvancarFase(lead.id)} />
            ))}
          </div>
        )}

        {frios.length > 0 && (
          <div>
            <div style={{ padding: "6px 12px 4px", fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sem resposta ({frios.length})
            </div>
            {frios.map((lead) => (
              <LeadCrmCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} onAvancar={() => onAvancarFase(lead.id)} />
            ))}
          </div>
        )}

        {leads.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Nenhum lead ativo</div>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCrmCard({ lead, onClick, onAvancar }: {
  lead: LiveLead;
  onClick: () => void;
  onAvancar: () => void;
}) {
  const config = PHASE_CONFIG[lead.fase];
  const isCritico = lead.fase === "critico";

  return (
    <div
      onClick={onClick}
      style={{
        margin: "4px 8px",
        padding: "8px 10px",
        borderRadius: 8,
        background: isCritico ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isCritico ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
        cursor: "pointer",
        transition: "all 150ms",
      }}
    >
      {/* Linha 1: número + nome + valor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: config.cor, flexShrink: 0,
            boxShadow: isCritico ? `0 0 6px ${config.cor}` : "none",
            animation: isCritico ? "pulse 1s infinite" : "none",
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
            #{lead.numero} {lead.nome_curto}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: config.cor }}>
          R${(lead.valor_estimado / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Linha 2: fase + tempo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: lead.ultima_mensagem ? 5 : 0 }}>
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 4,
          background: `${config.cor}20`, color: config.cor, fontWeight: 600,
        }}>
          {config.label}
        </span>
        <span style={{ fontSize: 9, color: isCritico ? "#ef4444" : "rgba(255,255,255,0.3)", fontWeight: isCritico ? 700 : 400 }}>
          {Math.floor(lead.tempo_na_fase_ms / 60000)}min{isCritico ? " ⚠️" : ""}
        </span>
      </div>

      {/* Última mensagem */}
      {lead.ultima_mensagem && (
        <div style={{
          fontSize: 9, color: "rgba(255,255,255,0.45)", fontStyle: "italic",
          borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 4, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {lead.ultima_mensagem.de === "agente"
            ? `${lead.ultima_mensagem.agente_nome}: `
            : "Lead: "}
          &ldquo;{lead.ultima_mensagem.texto}&rdquo;
        </div>
      )}

      {/* Botão avançar fase */}
      {!isCritico && lead.fase !== "match_realizado" && lead.fase !== "saindo" && (
        <button
          onClick={(e) => { e.stopPropagation(); onAvancar(); }}
          style={{
            marginTop: 6, width: "100%", padding: "4px", borderRadius: 5,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)", fontSize: 9, cursor: "pointer",
          }}
        >
          Avançar fase →
        </button>
      )}

      {/* Botão ação crítica */}
      {isCritico && (
        <button
          onClick={(e) => { e.stopPropagation(); onAvancar(); }}
          style={{
            marginTop: 6, width: "100%", padding: "5px", borderRadius: 5,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444", fontSize: 10, cursor: "pointer", fontWeight: 700,
          }}
        >
          Redistribuir fila →
        </button>
      )}
    </div>
  );
}
