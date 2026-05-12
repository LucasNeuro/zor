"use client";

import Link from "next/link";

interface Integration {
  nome: string;
  descricao: string;
  icon: string;
  cor: string;
  status: "conectado" | "pendente" | "nao_configurado";
  metricas?: { label: string; valor: string }[];
}

const INTEGRATIONS: Integration[] = [
  {
    nome: "Meta Ads",
    descricao: "Facebook & Instagram — Campanhas, CPL, ROAS e audiências",
    icon: "📘",
    cor: "#1877f2",
    status: "nao_configurado",
  },
  {
    nome: "Google Ads",
    descricao: "Search, Display & YouTube — CPL, conversões e palavras-chave",
    icon: "🔴",
    cor: "#ea4335",
    status: "nao_configurado",
  },
  {
    nome: "Google Analytics 4",
    descricao: "Tráfego orgânico, sessões, eventos e conversões do site",
    icon: "📊",
    cor: "#f9ab00",
    status: "nao_configurado",
  },
  {
    nome: "Instagram",
    descricao: "Engajamento, alcance, stories e DMs de leads",
    icon: "📸",
    cor: "#e1306c",
    status: "nao_configurado",
  },
];

const STATUS_LABELS = {
  conectado: { label: "Conectado", cor: "#22c55e" },
  pendente: { label: "Pendente", cor: "#f59e0b" },
  nao_configurado: { label: "Não configurado", cor: "#484f58" },
};

export default function IntegracoesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--obra-dark, #0d1117)", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/office" style={{ fontSize: 11, color: "var(--obra-texto-2, #8b949e)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
          ← Escritório Virtual
        </Link>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, maxWidth: 960 }}>
        {INTEGRATIONS.map(intg => {
          const st = STATUS_LABELS[intg.status];
          return (
            <div
              key={intg.nome}
              style={{
                background: "var(--obra-dark-2, #161b22)",
                border: "1px solid var(--obra-borda, #30363d)",
                borderRadius: 14,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Top */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${intg.cor}15`, border: `1px solid ${intg.cor}30`, fontSize: 22,
                }}>
                  {intg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obra-texto, #e6edf3)" }}>{intg.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--obra-texto-2, #8b949e)", marginTop: 2, lineHeight: 1.4 }}>{intg.descricao}</div>
                </div>
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.cor }} />
                <span style={{ fontSize: 11, color: st.cor, fontWeight: 600 }}>{st.label}</span>
              </div>

              {/* Métricas se conectado */}
              {intg.metricas && (
                <div style={{ display: "flex", gap: 8 }}>
                  {intg.metricas.map(m => (
                    <div key={m.label} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--obra-texto, #e6edf3)" }}>{m.valor}</div>
                      <div style={{ fontSize: 10, color: "var(--obra-texto-2, #8b949e)" }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA */}
              <button
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", border: `1px solid ${intg.cor}40`,
                  background: intg.status === "conectado" ? `${intg.cor}15` : "transparent",
                  color: intg.status === "conectado" ? intg.cor : "var(--obra-texto-2, #8b949e)",
                  transition: "all 150ms",
                }}
              >
                {intg.status === "conectado" ? "Gerenciar" : "Conectar"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Em breve */}
      <div style={{ marginTop: 40, padding: "20px 24px", borderRadius: 14, background: "var(--obra-dark-2, #161b22)", border: "1px solid var(--obra-borda, #30363d)", maxWidth: 960 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obra-texto, #e6edf3)", marginBottom: 6 }}>Em breve</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["WhatsApp Business API", "HubSpot", "RD Station", "ActiveCampaign", "Hotmart"].map(nome => (
            <span key={nome} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "var(--obra-texto-3, #484f58)", border: "1px solid var(--obra-borda-2, #21262d)" }}>
              {nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
