"use client";

import { useEffect } from "react";

interface Props {
  area: string;
  onClose: () => void;
}

const TITLES: Record<string, string> = {
  campanhas:   "📢 Campanhas",
  criacao:     "✍️ Criação",
  conteudo:    "📱 Conteúdo",
  pipeline:    "💼 Pipeline",
  atendimento: "📥 Atendimento",
  clientes:    "👥 Clientes",
  crm:         "🗂️ CRM",
};

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: 8, padding: "0 0 8px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
      {cols.map((c) => (
        <span key={c} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>{c}</span>
      ))}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}30`, borderRadius: 999, padding: "2px 7px" }}>
      {label}
    </span>
  );
}

function ActionBtn({ label, color = "#60a5fa" }: { label: string; color?: string }) {
  return (
    <button style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: color + "18", border: `1px solid ${color}30`, color, cursor: "pointer", fontWeight: 600 }}>
      {label}
    </button>
  );
}

function ContentByArea({ area }: { area: string }) {
  if (area === "campanhas") {
    const rows = [
      { canal: "Meta Ads",    inv: "R$2.4k", leads: "34", cpl: "R$89",  roas: "3.8x", status: "red"   },
      { canal: "Google Ads",  inv: "R$1.8k", leads: "28", cpl: "R$64",  roas: "4.2x", status: "green" },
    ];
    return (
      <div>
        <TableHeader cols={["CANAL","INVESTIDO","LEADS","CPL","ROAS","AÇÃO"]} />
        {rows.map((r) => {
          const c = r.status === "green" ? "#22c55e" : "#ef4444";
          return (
            <div key={r.canal} style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{r.canal}</span>
              <span style={{ fontSize: 12, color: "#e2e8f0" }}>{r.inv}</span>
              <span style={{ fontSize: 12, color: "#e2e8f0" }}>{r.leads}</span>
              <span style={{ fontSize: 12, color: c, fontWeight: 700 }}>{r.cpl}</span>
              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>{r.roas}</span>
              <ActionBtn label={r.status === "red" ? "Pausar" : "Escalar"} color={r.status === "red" ? "#ef4444" : "#22c55e"} />
            </div>
          );
        })}
      </div>
    );
  }

  if (area === "criacao") {
    const tasks = [
      { agente: "Copy Alpha",   tarefa: "Copy Meta Ads variação C",          status: "🔄", prazo: "Hoje 18h"  },
      { agente: "Design Alpha", tarefa: "Arte aprovada — exportar formatos",  status: "✅", prazo: "Concluído" },
      { agente: "Motion IA",    tarefa: "Aguardando material de ref. cliente", status: "⏳", prazo: "Amanhã"   },
      { agente: "Copy Beta",    tarefa: "Copy Google Ads revisão final",       status: "🔄", prazo: "Hoje 20h"  },
      { agente: "Design Beta",  tarefa: "Landing page reforma — UX review",    status: "✅", prazo: "Concluído" },
    ];
    return (
      <div>
        <TableHeader cols={["AGENTE","TAREFA","STATUS","PRAZO","AÇÃO"]} />
        {tasks.map((t) => (
          <div key={t.tarefa} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 0.5fr 1fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{t.agente}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{t.tarefa}</span>
            <span style={{ fontSize: 14 }}>{t.status}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{t.prazo}</span>
            <ActionBtn label="Aprovar" color="#22c55e" />
          </div>
        ))}
      </div>
    );
  }

  if (area === "pipeline") {
    const deals = [
      { nome: "Reforma Alphaville",    valor: "R$110k", etapa: "Aprovação",    resp: "Dir. Comercial", dias: 2,  status: "red"    },
      { nome: "Marcenaria Jardins",     valor: "R$65k",  etapa: "Negociação",   resp: "Closer",         dias: 5,  status: "yellow" },
      { nome: "Projeto Arq. Morumbi",   valor: "R$42k",  etapa: "Qualificado",  resp: "SDR",            dias: 1,  status: "green"  },
      { nome: "Reforma Comercial SP",   valor: "R$30k",  etapa: "Em contato",   resp: "SDR",            dias: 3,  status: "green"  },
    ];
    return (
      <div>
        <TableHeader cols={["LEAD","VALOR","ETAPA","RESP.","DIAS","AÇÃO"]} />
        {deals.map((d) => {
          const c = d.status === "red" ? "#ef4444" : d.status === "yellow" ? "#eab308" : "#22c55e";
          return (
            <div key={d.nome} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.5fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{d.nome}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{d.valor}</span>
              <Pill label={d.etapa} color={c} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{d.resp}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>{d.dias}d</span>
              <ActionBtn label="Redistribuir" color={c} />
            </div>
          );
        })}
      </div>
    );
  }

  if (area === "atendimento") {
    const leads = [
      { id: "L-044", origem: "Meta Ads",  tempo: "22 min", projeto: "Reforma residencial",  status: "urgente"    },
      { id: "L-045", origem: "Google",    tempo: "18 min", projeto: "Marcenaria sob medida", status: "urgente"    },
      { id: "L-046", origem: "Indicação", tempo: "11 min", projeto: "Projeto arquitetura",   status: "urgente"    },
      { id: "L-047", origem: "Meta Ads",  tempo: "4 min",  projeto: "Reforma cozinha",       status: "aguardando" },
      { id: "L-048", origem: "Google",    tempo: "2 min",  projeto: "Marcenaria completa",   status: "aguardando" },
    ];
    return (
      <div>
        <TableHeader cols={["ID","ORIGEM","ESPERA","PROJETO","AÇÃO"]} />
        {leads.map((l) => {
          const urgent = l.status === "urgente";
          const c = urgent ? "#ef4444" : "#22c55e";
          return (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 1fr 0.8fr 2fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{l.id}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{l.origem}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{l.tempo}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{l.projeto}</span>
              <ActionBtn label="Acionar SDR" color={c} />
            </div>
          );
        })}
      </div>
    );
  }

  if (area === "clientes") {
    const clientes = [
      { nome: "Construtora Alpha",   nps: 9.1, ultima: "Ontem",      parceiro: "Arq. Silva",  status: "saudavel" },
      { nome: "Reforma Jardins Ltda",nps: 8.4, ultima: "3 dias",     parceiro: "Marc. Beta",  status: "saudavel" },
      { nome: "Marcenaria Morumbi",  nps: 6.2, ultima: "7 dias",     parceiro: "Marc. Gamma", status: "atencao"  },
      { nome: "Projeto Alphaville",  nps: 5.8, ultima: "10 dias",    parceiro: "Arq. Delta",  status: "risco"    },
      { nome: "Home Design SP",      nps: 9.3, ultima: "Hoje",       parceiro: "Marc. Alpha", status: "saudavel" },
    ];
    return (
      <div>
        <TableHeader cols={["CLIENTE","NPS","ÚLTIMA INT.","PARCEIRO","STATUS","AÇÃO"]} />
        {clientes.map((c) => {
          const color = c.status === "saudavel" ? "#22c55e" : c.status === "atencao" ? "#eab308" : "#ef4444";
          const label = c.status === "saudavel" ? "Saudável" : c.status === "atencao" ? "Atenção" : "Em risco";
          return (
            <div key={c.nome} style={{ display: "grid", gridTemplateColumns: "2fr 0.6fr 1fr 1.2fr 1fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{c.nome}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{c.nps}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)" }}>{c.ultima}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{c.parceiro}</span>
              <Pill label={label} color={color} />
              <ActionBtn label="Contatar" color={color} />
            </div>
          );
        })}
      </div>
    );
  }

  if (area === "crm") {
    const followups = [
      { lead: "L-031 Reforma SP",    ultimo: "5 dias",  mensagem: "Olá! Vimos que você se interessou em reforma...", status: "vencido" },
      { lead: "L-028 Marcenaria RJ", ultimo: "4 dias",  mensagem: "Oi! Temos novidades sobre seu projeto...",         status: "vencido" },
      { lead: "L-025 Arq. BH",       ultimo: "3 dias",  mensagem: "Seu orçamento de arquitetura está pronto...",       status: "vencido" },
    ];
    return (
      <div>
        <TableHeader cols={["LEAD","ÚLTIMO CONTATO","MENSAGEM SUGERIDA","AÇÃO"]} />
        {followups.map((f) => (
          <div key={f.lead} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{f.lead}</span>
            <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>{f.ultimo} 🔴</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.mensagem}</span>
            <ActionBtn label="Disparar" color="#06b6d4" />
          </div>
        ))}
      </div>
    );
  }

  return <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 13 }}>Nenhum dado disponível para esta área.</p>;
}

export function DetailModal({ area, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.70)" }}
      />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 640, maxHeight: "82vh",
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14, zIndex: 2001,
          display: "flex", flexDirection: "column",
          animation: "modalIn 250ms cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>
            {TITLES[area] ?? area}
          </span>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" } as React.CSSProperties}>
          <ContentByArea area={area} />
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
      `}</style>
    </>
  );
}
