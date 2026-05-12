"use client";

import { Agent } from "./OfficeCanvas";

interface Props {
  agents: Agent[];
  activeMeeting: string | null;
}

const CARGO_CURTO: Record<string, string> = {
  "ag-001": "Gerente de Marketing",
  "ag-002": "CEO",
  "ag-003": "Estrategista",
  "ag-004": "Projetos",
  "ag-005": "Coordenação",
  "ag-006": "Copywriter",
  "ag-007": "Conteúdo",
  "ag-008": "Variações",
  "ag-009": "Designer",
  "ag-010": "UI/UX",
  "ag-011": "Motion",
  "ag-012": "Google Ads",
  "ag-013": "Meta Ads",
  "ag-014": "Analytics",
  "ag-015": "Social Media",
  "ag-016": "Conteúdo",
  "ag-017": "Comunidade",
  "ag-018": "SDR",
  "ag-019": "Recepção",
  "ag-020": "Dir. Comercial",
  "ag-021": "Ger. Vendas",
  "ag-022": "Closer",
  "ag-023": "Cust. Success",
  "ag-024": "CRM IA",
  "ag-025": "Ger. Atend.",
};

const AREA_COLORS: Record<string, string> = {
  "Executivo":    "#f59e0b",
  "Marketing":    "#22c55e",
  "Estratégia":   "#60a5fa",
  "Conteúdo":     "#a78bfa",
  "Design":       "#f472b6",
  "Performance":  "#34d399",
  "Atendimento":  "#06b6d4",
  "Comercial":    "#fb923c",
};

function getActivityText(agent: Agent): string {
  if (agent.currentActivity) return agent.currentActivity;
  const fn = agent.funcao.toLowerCase();
  if (fn.includes("ceo"))            return "Revisando metas do trimestre";
  if (fn.includes("gerente"))        return "Coordenando entregas da equipe";
  if (fn.includes("plano"))          return "Elaborando estratégia de campanha";
  if (fn.includes("brief"))          return "Coletando briefing do cliente";
  if (fn.includes("agenda"))         return "Organizando calendário editorial";
  if (fn.includes("copy"))           return "Criando copy para anúncio";
  if (fn.includes("designer gráfico")) return "Desenvolvendo arte para Meta Ads";
  if (fn.includes("ui/ux"))          return "Otimizando landing page";
  if (fn.includes("motion"))         return "Animando reel para campanha";
  if (fn.includes("google"))         return "Ajustando lances no Google Ads";
  if (fn.includes("meta"))           return "Escalando campanha no Meta";
  if (fn.includes("analytics"))      return "Analisando performance do período";
  if (fn.includes("social media"))   return "Publicando conteúdo no Instagram";
  if (fn.includes("criador"))        return "Gravando Reels da campanha";
  if (fn.includes("community"))      return "Respondendo comentários da comunidade";
  if (fn.includes("atendimento"))    return "Qualificando lead na fila";
  if (fn.includes("recepcionista"))  return "Recebendo novo contato";
  return "Trabalhando em tarefa prioritária";
}

export function DashboardPanel({ agents, activeMeeting }: Props) {
  const hasDecision = agents.some((a) => a.needsUserDecision);
  const hasCritical = agents.some((a) => a.governanca.score < 70);
  const hasWarning  = agents.some((a) => a.governanca.score < 80);

  const urgentAgent = agents.find((a) => a.needsUserDecision || a.governanca.score < 70);
  const warnAgent   = agents.find((a) => a.governanca.score < 80);

  /* Lead queue simulation */
  const leadQueue = [
    { id: "L-047", origem: "Meta Ads",  tempo_min: 2, projeto: "Reforma residencial",  status: "aguardando" as const },
    { id: "L-048", origem: "Google",    tempo_min: 7, projeto: "Marcenaria sob medida", status: "urgente"    as const },
    { id: "L-049", origem: "Indicação", tempo_min: 1, projeto: "Projeto arquitetura",   status: "aguardando" as const },
  ];
  const leadsUrgentes = leadQueue.filter((l) => l.tempo_min > 5).length;
  const isLeadUrgent  = leadsUrgentes > 0;

  const isRed    = hasDecision || hasCritical;
  const isYellow = !isRed && (hasWarning || isLeadUrgent);

  /* Zone 2 — pick 5 most active agents for "happening now" */
  const liveAgents = [...agents]
    .sort((a, b) => b.tarefas.ativas - a.tarefas.ativas)
    .slice(0, 5);

  /* Zone 3 — business metrics */
  const totalLeads      = 23;
  const leadsQualif     = 8;
  const emNegociacao    = "R$ 52k";
  const fechadosHoje    = 1;
  const campanhasAtivas = 2;
  const investido       = "R$ 847";

  return (
    <aside
      className="flex h-full w-[300px] shrink-0 flex-col overflow-y-auto"
      style={{
        background: "#131c2e",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
      }}
    >

      {/* ═══ ZONA 1 — PRECISA DE VOCÊ ═══ */}
      <section
        style={{
          margin: "12px 12px 0",
          borderRadius: 12,
          padding: "12px 14px",
          background: isRed
            ? "rgba(239,68,68,0.09)"
            : isYellow
              ? "rgba(234,179,8,0.08)"
              : "rgba(34,197,94,0.07)",
          border: `1px solid ${
            isRed ? "rgba(239,68,68,0.22)" : isYellow ? "rgba(234,179,8,0.18)" : "rgba(34,197,94,0.16)"
          }`,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.30)",
            marginBottom: 8,
          }}
        >
          PRECISA DE VOCÊ
        </p>

        {isRed ? (
          <div>
            <p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              🔴{" "}
              {urgentAgent?.decisionDescription ||
                `${urgentAgent?.nome} requer decisão`}
            </p>
            <button
              style={{
                marginTop: 6, padding: "4px 10px",
                background: "rgba(239,68,68,0.18)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 6, color: "#fca5a5",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              Ver o que precisa →
            </button>
          </div>
        ) : isYellow ? (
          <p style={{ color: "#fde68a", fontSize: 13, fontWeight: 600 }}>
            🟡 Atenção — {warnAgent?.nome} abaixo do esperado
          </p>
        ) : (
          <p style={{ color: "#86efac", fontSize: 13, fontWeight: 600 }}>
            ✅ Tudo fluindo — nenhuma ação necessária
          </p>
        )}
      </section>

      {/* ═══ ZONA 2 — ACONTECENDO AGORA ═══ */}
      <section style={{ margin: "14px 12px 0" }}>
        <p
          style={{
            fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.30)",
            marginBottom: 8,
          }}
        >
          ACONTECENDO AGORA
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {liveAgents.map((agent) => {
            const color = AREA_COLORS[agent.area] ?? "#60a5fa";
            return (
              <div
                key={agent.id}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 9, padding: "8px 10px",
                }}
              >
                <span style={{ position: "relative", flexShrink: 0, width: 8, height: 8 }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.5, animation: "statusPing 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {agent.nome}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ fontWeight: 400 }}>{CARGO_CURTO[agent.id] ?? agent.funcao}</span>
                    <span style={{ color: "rgba(255,255,255,0.22)" }}> · </span>
                    {getActivityText(agent)}
                  </p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: color, background: color + "18", border: `1px solid ${color}30`, borderRadius: 999, padding: "1px 6px" }}>
                  {agent.tarefas.ativas}
                </span>
              </div>
            );
          })}
        </div>

        {/* Lead queue sub-section */}
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", marginBottom: 6 }}>
            FILA DE LEADS
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {leadQueue.map((lead) => {
              const urgent = lead.tempo_min > 5;
              const dotColor = urgent ? "#ef4444" : "#22c55e";
              return (
                <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 8, background: urgent ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${urgent ? "rgba(239,68,68,0.20)" : "rgba(255,255,255,0.04)"}`, borderRadius: 8, padding: "6px 9px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: urgent ? "#fca5a5" : "#e2e8f0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {lead.projeto}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      {lead.origem} · {lead.tempo_min} min
                    </p>
                  </div>
                  {urgent && <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>URGENTE</span>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ ZONA 3 — HOJE EM NÚMEROS ═══ */}
      <section style={{ margin: "14px 12px 12px" }}>
        <p
          style={{
            fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.30)",
            marginBottom: 8,
          }}
        >
          HOJE EM NÚMEROS
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Leads hoje",     value: String(totalLeads),     sub: "recebidos",        color: "#06b6d4" },
            { label: "Qualificados",   value: String(leadsQualif),    sub: `de ${totalLeads}`, color: "#22c55e" },
            { label: "Fechamentos",    value: String(fechadosHoje),   sub: "contratos",        color: "#f472b6" },
            { label: "Em negociação",  value: emNegociacao,           sub: "em aberto",        color: "#fb923c" },
            { label: "Campanhas",      value: String(campanhasAtivas), sub: "ativas",          color: "#a78bfa" },
            { label: "Investido",      value: investido,               sub: "hoje",            color: "#f59e0b" },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "10px 12px",
              }}
            >
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginBottom: 4 }}>{label}</p>
              <p style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1, marginBottom: 2 }}>{value}</p>
              <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SEPARADOR — Saúde da operação ═══ */}
      <section
        style={{
          margin: "0 12px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", marginBottom: 10 }}>
          SAÚDE DA OPERAÇÃO
        </p>
        {agents
          .filter((a) => a.governanca.score < 90)
          .sort((a, b) => a.governanca.score - b.governanca.score)
          .slice(0, 4)
          .map((a) => {
            const sc = a.governanca.score >= 85 ? "#22c55e" : a.governanca.score >= 70 ? "#eab308" : "#ef4444";
            return (
              <div key={a.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{a.nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc }}>{a.governanca.score}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
                  <div style={{ width: `${a.governanca.score}%`, height: "100%", background: sc, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ position: "relative", flexShrink: 0, width: 7, height: 7 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22c55e", opacity: 0.5, animation: "statusPing 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22c55e" }} />
          </span>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>
            {agents.filter((a) => a.status.online).length} de {agents.length} trabalhando
          </p>
        </div>
      </section>

    </aside>
  );
}
