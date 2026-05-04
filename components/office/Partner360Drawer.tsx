"use client";

import { useState } from "react";
import {
  Partner, getPartnerStatusLabel, getPartnerStatusColor,
  HOMOLOGACAO_ETAPAS, getHomologacaoEtapaIndex,
} from "@/lib/data/partners-mock";

type Tab = "visao_geral" | "performance" | "homologacao" | "acao";

const CATEGORIA_LABEL: Record<string, string> = {
  arquiteto: "Arquiteto",
  designer: "Designer de Interiores",
  engenheiro: "Engenheiro",
  decorador: "Decorador",
  construtora: "Construtora",
};

const DOC_STATUS_COLOR: Record<string, string> = {
  ok: "#22c55e",
  pendente: "#eab308",
  vencido: "#ef4444",
};

function ScoreCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, padding: "8px 10px", borderRadius: 8,
      background: "rgba(255,255,255,0.03)", border: `1px solid ${color}33`,
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

export default function Partner360Drawer({ partner, onClose, onAction }: {
  partner: Partner;
  onClose: () => void;
  onAction?: (acao: string, partnerId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("visao_geral");

  const statusColor = getPartnerStatusColor(partner.status);
  const etapaIndex = getHomologacaoEtapaIndex(partner.homologacao_etapa);
  const capacidadeUsada = partner.obras_ativas / partner.capacidade_simultanea;
  const capacidadeColor = capacidadeUsada >= 1 ? "#ef4444" : capacidadeUsada >= 0.75 ? "#eab308" : "#22c55e";

  const transpColor = partner.transparency_score >= 85 ? "#22c55e" : partner.transparency_score >= 65 ? "#eab308" : "#ef4444";

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
                {getPartnerStatusLabel(partner.status)}
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{CATEGORIA_LABEL[partner.categoria]}</span>
            </div>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: "0 2px" }}
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc", marginBottom: 2 }}>{partner.nome}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {partner.empresa} · {partner.cidade}/{partner.estado}
          </div>

          {/* Score grid */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {partner.status !== "em_homologacao" ? (
              <>
                <ScoreCard label="Fit Score"    value={`${partner.fit_score_atual ?? "–"}%`} color="#60a5fa" sub="atual" />
                <ScoreCard label="Transparência" value={`${partner.transparency_score}`}     color={transpColor} sub="/100" />
                <ScoreCard label="NPS"          value={`${partner.nps || "–"}`}             color="#a78bfa" sub="avg" />
                <ScoreCard label="Fechamento"   value={`${partner.taxa_fechamento}%`}        color={capacidadeColor} sub={`${partner.obras_ativas}/${partner.capacidade_simultanea} obras`} />
              </>
            ) : (
              <>
                <ScoreCard label="Etapa"        value={`${etapaIndex + 1}/10`}              color="#60a5fa" sub={HOMOLOGACAO_ETAPAS[etapaIndex]?.label} />
                <ScoreCard label="Progresso"    value={`${partner.homologacao_progresso}%`} color="#eab308" sub="homologação" />
                <ScoreCard label="Capacidade"   value={`${partner.capacidade_simultanea}`}  color="#22c55e" sub="obras simult." />
                <ScoreCard label="Ticket Médio" value={`R$${(partner.ticket_medio / 1000).toFixed(0)}k`} color="#a78bfa" sub="estimado" />
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0, background: "rgba(255,255,255,0.01)",
        }}>
          {(["visao_geral", "performance", "homologacao", "acao"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { visao_geral: "Visão Geral", performance: "Performance", homologacao: "Homologação", acao: "Ação" };
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "9px 0", fontSize: 10, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#a78bfa" : "rgba(255,255,255,0.4)",
                  background: "transparent", border: "none",
                  borderBottom: isActive ? "2px solid #a78bfa" : "2px solid transparent",
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
              <Field label="Empresa"          value={partner.empresa} />
              <Field label="Telefone"         value={partner.telefone} />
              <Field label="E-mail"           value={partner.email} />
              <Field label="Ticket médio"     value={`R$${partner.ticket_medio.toLocaleString("pt-BR")}`} />
              <Field label="Capacidade"       value={`${partner.obras_ativas} ativas / ${partner.capacidade_simultanea} máx`} />
              <Field label="Total comissões"  value={`R$${partner.total_comissoes.toLocaleString("pt-BR")}`} />
              <Field label="Cadastrado em"    value={new Date(partner.cadastrado_em).toLocaleDateString("pt-BR")} />

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Especialidades</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {partner.especialidades.map((e) => (
                    <span key={e} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              {partner.notas && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notas</div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, margin: 0 }}>{partner.notas}</p>
                </div>
              )}
            </div>
          )}

          {tab === "performance" && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Últimos Matches</div>
                {partner.ultimos_matches.length === 0 ? (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Sem matches ainda.</p>
                ) : (
                  partner.ultimos_matches.map((m) => {
                    const mColor = m.status === "fechado" ? "#22c55e" : m.status === "perdido" ? "#ef4444" : "#eab308";
                    return (
                      <div key={m.lead_id} style={{
                        marginBottom: 6, padding: "8px 10px", borderRadius: 7,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#f8fafc" }}>{m.lead_nome}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{new Date(m.data).toLocaleDateString("pt-BR")}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa" }}>R${m.valor.toLocaleString("pt-BR")}</div>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${mColor}22`, color: mColor }}>
                            {m.status === "fechado" ? "Fechado" : m.status === "perdido" ? "Perdido" : "Em andamento"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Documentos</div>
                {partner.documentos.map((doc) => {
                  const dc = DOC_STATUS_COLOR[doc.status];
                  return (
                    <div key={doc.nome} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{doc.nome}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {doc.validade && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>válido até {new Date(doc.validade).toLocaleDateString("pt-BR")}</span>}
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${dc}22`, color: dc }}>
                          {doc.status === "ok" ? "OK" : doc.status === "pendente" ? "Pendente" : "Vencido"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "homologacao" && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Progresso geral</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#eab308" }}>{partner.homologacao_progresso}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${partner.homologacao_progresso}%`,
                    background: partner.homologacao_progresso === 100 ? "#22c55e" : "#eab308",
                    transition: "width 500ms ease",
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {HOMOLOGACAO_ETAPAS.map((etapa, i) => {
                  const isDone = i < etapaIndex;
                  const isCurrent = i === etapaIndex;
                  const isPending = i > etapaIndex;
                  const dotColor = isDone ? "#22c55e" : isCurrent ? "#eab308" : "rgba(255,255,255,0.12)";
                  return (
                    <div key={etapa.id} style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "6px 10px", borderRadius: 7,
                      background: isCurrent ? "rgba(234,179,8,0.06)" : "transparent",
                      border: isCurrent ? "1px solid rgba(234,179,8,0.15)" : "1px solid transparent",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: dotColor, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: isDone || isCurrent ? "#0d1420" : "transparent",
                          fontWeight: 700,
                        }}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        {i < HOMOLOGACAO_ETAPAS.length - 1 && (
                          <div style={{ width: 1, height: 12, background: isDone ? "#22c55e" : "rgba(255,255,255,0.08)", marginTop: 2 }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: isCurrent ? 700 : 500, color: isPending ? "rgba(255,255,255,0.3)" : "#f8fafc" }}>
                          {etapa.label}
                          {isCurrent && <span style={{ marginLeft: 6, fontSize: 8, color: "#eab308" }}>← atual</span>}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.3 }}>{etapa.descricao}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "acao" && (
            <div>
              {[
                { label: "Aprovar para próxima etapa",     acao: "aprovar_etapa",    color: "#22c55e", show: partner.status === "em_homologacao" },
                { label: "Ativar parceiro",                acao: "ativar",           color: "#22c55e", show: partner.status !== "ativo" && partner.status !== "em_homologacao" },
                { label: "Solicitar documentação",         acao: "solicitar_doc",    color: "#60a5fa", show: true },
                { label: "Agendar entrevista",             acao: "entrevista",       color: "#a78bfa", show: partner.status === "em_homologacao" },
                { label: "Pausar parceiro",                acao: "pausar",           color: "#eab308", show: partner.status === "ativo" || partner.status === "ocupado" },
                { label: "Reprovar e encerrar processo",   acao: "reprovar",         color: "#ef4444", show: true },
              ].filter((btn) => btn.show).map((btn) => (
                <button
                  key={btn.acao}
                  onClick={() => onAction?.(btn.acao, partner.id)}
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
