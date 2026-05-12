"use client";
import { useRouter } from "next/navigation";
import { useMetricas } from "@/hooks/useMetricas";
import { useAgentes } from "@/hooks/useAgentes";

export default function DashboardPage() {
  const router = useRouter();
  const m = useMetricas();
  const { agentes } = useAgentes();

  const cards = [
    { label: "Leads aguardando você", valor: m.leadsAguardando, cor: m.leadsAguardando > 0 ? "#c9a24a" : "#003b26", rota: "/crm/leads" },
    { label: "Aprovações pendentes", valor: m.aprovacoesPendentes, cor: m.aprovacoesPendentes > 0 ? "#b3261e" : "#003b26", rota: "/crm/aprovacoes" },
    { label: "Conversas ativas", valor: m.conversasAtivas, cor: "#003b26", rota: "/crm/atendimento" },
    { label: "Leads hoje", valor: m.leadsHoje, cor: "#003b26", rota: "/crm/leads" },
    { label: "Agentes IA ativos", valor: m.agentesAtivos, cor: "#003b26", rota: "/crm/agentes" },
    {
      label: "Receita potencial",
      valor: m.receitaPotencial > 0 ? `R$${(m.receitaPotencial / 1000).toFixed(0)}k` : "R$0",
      cor: "#c9a24a",
      rota: "/crm/leads",
    },
  ];

  const cardsParceiros = [
    { label: "Parceiros ativos", valor: m.parceirosAtivos, cor: "#60a5fa", rota: "/crm/parceiros" },
    { label: "Encaminhamentos hoje", valor: m.encaminhamentosHoje, cor: "#a78bfa", rota: "/crm/parceiros" },
    { label: "Taxa qualificação", valor: `${m.taxaQualificacao}%`, cor: "#34d399", rota: "/crm/leads" },
    { label: "Taxa encaminhamento", valor: `${m.taxaEncaminhamento}%`, cor: "#f59e0b", rota: "/crm/parceiros" },
  ];

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: "1.5rem" }}>
      {/* Atendimento */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ color: "#484f58", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>Atendimento</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {cards.map(c => (
            <button key={c.label} onClick={() => router.push(c.rota)}
              style={{
                borderRadius: 14, padding: "16px 14px", textAlign: "left", cursor: "pointer",
                background: "#161b22", border: `1px solid ${c.cor}40`,
                borderLeft: `3px solid ${c.cor}`, transition: "transform 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
              <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 4px" }}>{c.label}</p>
              <p style={{ fontSize: 28, fontWeight: 900, margin: 0, color: (c.valor !== 0 && c.valor !== "R$0") ? c.cor : "#e6edf3", letterSpacing: "-1px" }}>
                {c.valor}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Parceiros */}
      <div style={{ marginBottom: 24, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ color: "#484f58", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Rede de Parceiros</p>
          <button onClick={() => router.push("/crm/parceiros/novo")}
            style={{ fontSize: 11, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
            + Convidar parceiro
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {cardsParceiros.map(c => (
            <button key={c.label} onClick={() => router.push(c.rota)}
              style={{
                borderRadius: 14, padding: "16px 14px", textAlign: "left", cursor: "pointer",
                background: "#161b22", border: `1px solid ${c.cor}40`,
                borderLeft: `3px solid ${c.cor}`, transition: "transform 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
              <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 4px" }}>{c.label}</p>
              <p style={{ fontSize: 28, fontWeight: 900, margin: 0, color: c.cor, letterSpacing: "-1px" }}>
                {c.valor}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Equipe */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, margin: 0 }}>Equipe IA</h2>
          <button onClick={() => router.push("/crm/agentes")} style={{ fontSize: 12, color: "#c9a24a", background: "none", border: "none", cursor: "pointer" }}>
            Ver todos →
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {agentes.map(a => (
            <button key={a.agente_slug} onClick={() => router.push(`/crm/agentes/${a.agente_slug}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, background: "#0d1117", border: "1px solid #30363d",
                cursor: "pointer", textAlign: "left", transition: "border-color 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#c9a24a40"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#30363d"; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#003b26", color: "#c9a24a", fontWeight: 800, fontSize: 14,
              }}>
                {(a.nome || "?").charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</p>
                <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{a.cargo}</p>
              </div>
              <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "#003b2630", color: "#c9a24a" }}>
                N{a.nivel}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
