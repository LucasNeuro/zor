"use client";

import { useState } from "react";
import {
  Lead, getLeadStatusLabel, getLeadStatusColor,
  getPrioridadeLabel, getSlaStatus,
} from "@/lib/data/leads-mock";
import { PARTNERS_MOCK } from "@/lib/data/partners-mock";

type Tab = "visao_geral" | "historico" | "parceiros" | "acao";

const URGENCIA_LABEL: Record<string, string> = {
  imediata: "Imediata",
  "1_3_meses": "1-3 meses",
  "3_6_meses": "3-6 meses",
  "6_meses_plus": "+6 meses",
};

const INTENCAO_LABEL: Record<string, string> = {
  reforma_completa: "Reforma Completa",
  reforma_parcial: "Reforma Parcial",
  construcao: "Construção",
  decoracao: "Decoração",
};

const CONTATO_ICON: Record<string, string> = {
  ligacao: "📞",
  whatsapp: "💬",
  email: "✉️",
  sistema: "⚙️",
};

function ScoreCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, padding: "8px 10px", borderRadius: 8,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}33`,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
      {sub && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{sub}</span>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{label}</span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function Lead360Drawer({ lead, onClose, onAction }: {
  lead: Lead;
  onClose: () => void;
  onAction?: (acao: string, leadId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("visao_geral");

  const statusColor = getLeadStatusColor(lead.status);
  const slaStatus = getSlaStatus(lead.sla_tempo, lead.sla_meta);
  const slaColor = { ok: "#22c55e", atencao: "#eab308", critico: "#f97316", estourado: "#ef4444" }[slaStatus];
  const prioColor = lead.prioridade >= 90 ? "#ef4444" : lead.prioridade >= 70 ? "#f97316" : lead.prioridade >= 50 ? "#eab308" : "#22c55e";

  const suggestedPartners = PARTNERS_MOCK.filter(
    (p) => p.status === "ativo" && p.fit_score_atual != null
  ).sort((a, b) => (b.fit_score_atual ?? 0) - (a.fit_score_atual ?? 0)).slice(0, 3);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }}
      />
      <div style={{
        position: "fixed", right: 0, top: 0, width: 440, height: "100vh",
        background: "#0d1420", borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 1001, display: "flex", flexDirection: "column",
        animation: "slideInRight 300ms ease",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                {getLeadStatusLabel(lead.status)}
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Lead #{lead.numero}</span>
            </div>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: "0 2px" }}
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc", marginBottom: 2 }}>{lead.nome}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {lead.cidade}/{lead.estado} · {lead.origem} · {lead.campanha}
          </div>

          {/* Score grid */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <ScoreCard
              label="Prioridade"
              value={`${lead.prioridade}`}
              color={prioColor}
              sub={getPrioridadeLabel(lead.prioridade)}
            />
            <ScoreCard
              label="Valor Est."
              value={`R$${(lead.orcamento_estimado / 1000).toFixed(0)}k`}
              color="#a78bfa"
              sub={lead.categoria.replace("_", " ")}
            />
            <ScoreCard
              label="SLA"
              value={lead.sla_tempo > 0 ? `${lead.sla_tempo}min` : "OK"}
              color={slaColor}
              sub={`meta ${lead.sla_meta}min`}
            />
            <ScoreCard
              label="Match%"
              value={`${lead.fit_score}%`}
              color="#60a5fa"
              sub="fit score"
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0, background: "rgba(255,255,255,0.01)",
        }}>
          {(["visao_geral", "historico", "parceiros", "acao"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { visao_geral: "Visão Geral", historico: "Histórico", parceiros: "Parceiros", acao: "Ação" };
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "9px 0", fontSize: 10, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#60a5fa" : "rgba(255,255,255,0.4)",
                  background: "transparent", border: "none",
                  borderBottom: isActive ? "2px solid #60a5fa" : "2px solid transparent",
                  cursor: "pointer", transition: "all 150ms",
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

          {tab === "visao_geral" && (
            <div>
              <Field label="Intenção"     value={INTENCAO_LABEL[lead.intencao]} />
              <Field label="Urgência"     value={URGENCIA_LABEL[lead.urgencia]} />
              <Field label="Orçamento"    value={`R$${lead.orcamento_estimado.toLocaleString("pt-BR")}`} />
              {lead.area_m2 && <Field label="Área" value={`${lead.area_m2}m²`} />}
              {lead.estilo_preferido && <Field label="Estilo" value={lead.estilo_preferido} />}
              {lead.prazo_desejado && <Field label="Prazo desejado" value={lead.prazo_desejado} />}
              <Field label="Telefone"     value={lead.telefone} />
              <Field label="E-mail"       value={lead.email} />
              <Field label="Criado em"    value={new Date(lead.criado_em).toLocaleDateString("pt-BR")} />

              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Próxima Ação</div>
                <p style={{ fontSize: 11, color: "#f0fdf4", lineHeight: 1.5, margin: 0 }}>{lead.proxima_acao}</p>
              </div>

              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Descrição</div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, margin: 0 }}>{lead.descricao_projeto}</p>
              </div>

              {lead.notas && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notas</div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{lead.notas}</p>
                </div>
              )}
            </div>
          )}

          {tab === "historico" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...lead.historico].reverse().map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, flexShrink: 0,
                  }}>
                    {CONTATO_ICON[item.tipo]}
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{item.texto}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {item.agente} · {new Date(item.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "parceiros" && (
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                Parceiros sugeridos para este lead com base no fit score.
              </p>
              {suggestedPartners.map((p) => (
                <div key={p.id} style={{
                  marginBottom: 8, padding: "10px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#f8fafc" }}>{p.nome}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{p.empresa} · {p.cidade}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                      Transp. {p.transparency_score} · NPS {p.nps} · Fechamento {p.taxa_fechamento}%
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>{p.fit_score_atual}%</span>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>fit</span>
                  </div>
                </div>
              ))}
              <button
                onClick={() => onAction?.("realizar_match", lead.id)}
                style={{
                  marginTop: 8, width: "100%", padding: "9px 0", borderRadius: 8,
                  background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
                  color: "#60a5fa", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                Realizar Match
              </button>
            </div>
          )}

          {tab === "acao" && (
            <div>
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Situação atual</div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>{lead.proxima_acao}</p>
              </div>

              {[
                { label: "Ligar agora",           acao: "ligar",              color: "#22c55e" },
                { label: "Enviar WhatsApp",        acao: "whatsapp",           color: "#22c55e" },
                { label: "Realizar Match",         acao: "realizar_match",     color: "#60a5fa" },
                { label: "Escalar para humano",    acao: "escalar",            color: "#eab308" },
                { label: "Marcar como perdido",    acao: "marcar_perdido",     color: "#ef4444" },
              ].map((btn) => (
                <button
                  key={btn.acao}
                  onClick={() => onAction?.(btn.acao, lead.id)}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8, marginBottom: 6,
                    background: `${btn.color}12`, border: `1px solid ${btn.color}33`,
                    color: btn.color, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
