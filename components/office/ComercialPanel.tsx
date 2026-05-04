"use client";

import { useState } from "react";
import { ProgressBar, Semaforo, ActionButton } from "./PanelComponents";
import { PanelItem } from "./PanelItem";
import { SlidePanel, SlidePanelItem } from "./SlidePanel";
import { LiveFeed } from "./LiveFeed";
import { Alert } from "@/lib/alerts-system";

interface ComercialPanelProps {
  onVerTudo: (area: string) => void;
  feed?: Alert[];
  onAgenteClick?: (agenteId: string) => void;
}

const LEADS_ITEMS: SlidePanelItem[] = [
  {
    id: "l1", titulo: "Lead #247 — 18 min na fila",
    subtitulo: "Potencial R$80k · URGENTE", severity: "critical",
    alert: {
      id: "alt-003", severity: "critical", area: "atendimento",
      titulo: "Lead sem resposta", agente_id: "ag-022",
      descricao: "Lead com alto potencial aguarda há 18 min. Conversão cai 40% após 20 min.",
      acao_label: "Acionar SDR", acao_tipo: "acionar_sdr", acao_dados: { lead_id: "#247" },
      timestamp: new Date(Date.now() - 18 * 60 * 1000), resolvido: false,
    },
    agente_id: "ag-022",
  },
  { id: "l2", titulo: "Lead #248 — 12 min", subtitulo: "Potencial R$45k", severity: "warning", agente_id: "ag-022" },
  { id: "l3", titulo: "Lead #249 — 6 min", subtitulo: "Potencial R$30k", severity: "warning", agente_id: "ag-022" },
];

const MATCH_ITEMS: SlidePanelItem[] = [
  {
    id: "m1", titulo: "Proposta R$110k — aguarda aprovação",
    subtitulo: "João Silva · Closer enviou há 2h", severity: "critical",
    alert: {
      id: "alt-002", severity: "critical", area: "comercial",
      titulo: "Proposta aguarda aprovação",
      descricao: "Lead João Silva com histórico de 2 contratos. Proposta dentro da margem de 32%. Recomendar aprovar.",
      acao_label: "✓ Aprovar", acao_tipo: "aprovar_proposta", acao_dados: { valor: 110000 },
      agente_id: "ag-021", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), resolvido: false,
    },
    agente_id: "ag-021",
  },
  { id: "m2", titulo: "Match — Reforma SP R$65k", subtitulo: "Closer ativo · Dia 3 de negociação", severity: "warning", agente_id: "ag-021" },
  { id: "m3", titulo: "Match — Marcenaria R$42k", subtitulo: "SDR qualificando · Hoje", severity: "ok", agente_id: "ag-022" },
];

const PARCEIROS_ITEMS: SlidePanelItem[] = [
  { id: "pa1", titulo: "Marcenaria Belo · 12 projetos", subtitulo: "NPS 9.1 · Comissão R$8.4k", severity: "ok", agente_id: "ag-023" },
  { id: "pa2", titulo: "Arq. Maria Santos · 8 projetos", subtitulo: "NPS 8.7 · Novo parceiro", severity: "ok", agente_id: "ag-023" },
  { id: "pa3", titulo: "Engenheiro Costa · 3 projetos", subtitulo: "NPS 6.2 · Atenção", severity: "warning", agente_id: "ag-023" },
];

export function ComercialPanel({ onVerTudo, feed = [], onAgenteClick }: ComercialPanelProps) {
  const [active, setActive] = useState<string>("leads");
  const [slide, setSlide] = useState<string | null>(null);

  const toggle = (id: string) => setActive((prev) => (prev === id ? "" : id));

  const filteredFeed = feed.filter((a) => ["comercial", "atendimento", "clientes", "crm"].includes(a.area));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(34,197,94,0.02)" }}>

      {/* Panel header */}
      <div style={{
        height: 28, padding: "0 12px", display: "flex", alignItems: "center",
        flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(34,197,94,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Comercial · Hub
        </span>
      </div>

      {/* Accordion items */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* LEADS EM MOVIMENTO */}
        <PanelItem
          icon="📥" label="Leads em Movimento" badge="fila: 3" alertCount={1} severity="critical"
          isActive={active === "leads"} onToggle={() => toggle("leads")}
          onVerTudo={() => setSlide("leads")}
        >
          {/* Leads urgentes — > 15 min sem contato */}
          {[
            { id: "#247", tempo: "18 min", projeto: "Reforma SP", valor: "R$80k estimado" },
          ].map((u, i) => (
            <div key={i} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 11 }}>🔴</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>
                  Lead {u.id} — sem contato {u.tempo}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                {u.projeto} · {u.valor}
              </div>
              <ActionButton label="Acionar SDR" variant="danger" />
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Tempo médio resp.</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Semaforo status="red" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>8 min</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>meta 5</span>
            </div>
          </div>
          {[
            { id: "#247", tempo: "18 min", valor: "R$80k est.", status: "red"    as const },
            { id: "#248", tempo: "12 min", valor: "R$45k est.", status: "yellow" as const },
            { id: "#249", tempo: "6 min",  valor: "R$30k est.", status: "yellow" as const },
          ].map((lead, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Semaforo status={lead.status} />
                <div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Lead {lead.id}</span>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{lead.valor}</div>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: lead.status === "red" ? "#ef4444" : "#eab308" }}>
                {lead.tempo}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 6 }}><ActionButton label="Acionar SDR agora" variant="danger" /></div>
          <div style={{ marginTop: 8, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "✅ Qualificados hoje", valor: "24", color: "#22c55e" },
              { label: "🔄 Em qualificação",   valor: "5",  color: "#60a5fa" },
              { label: "📊 Taxa contato",       valor: "93%",color: "#22c55e" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{s.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{s.valor}</span>
              </div>
            ))}
          </div>
        </PanelItem>

        {/* PARCEIROS */}
        <PanelItem
          icon="🤝" label="Parceiros" badge="47 ativos"
          isActive={active === "parceiros"} onToggle={() => toggle("parceiros")}
          onVerTudo={() => setSlide("parceiros")}
        >
          {[
            { label: "Homologados",   valor: 47, total: 52, status: "green"  as const },
            { label: "Em avaliação",  valor: 5,  total: 52, status: "yellow" as const },
            { label: "Suspensos",     valor: 0,  total: 52, status: "green"  as const },
          ].map((s, i) => (
            <div key={i} style={{ marginBottom: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Semaforo status={s.status} />
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.status === "green" ? "#22c55e" : "#eab308" }}>{s.valor}</span>
              </div>
              <ProgressBar value={s.valor} max={s.total} color={s.status === "green" ? "#22c55e" : "#eab308"} />
            </div>
          ))}
          <div style={{ marginTop: 8, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "Match Rate",       valor: "62%",     color: "#eab308" },
              { label: "Comissão gerada",  valor: "R$28.4k", color: "#22c55e" },
              { label: "NPS parceiros",    valor: "8.6",     color: "#22c55e" },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.color }}>{m.valor}</span>
              </div>
            ))}
          </div>
        </PanelItem>

        {/* PÓS-MATCH */}
        <PanelItem
          icon="🏗️" label="Pós-Match" badge="R$247k" alertCount={1} severity="critical"
          isActive={active === "pos-match"} onToggle={() => toggle("pos-match")}
          onVerTudo={() => setSlide("pos-match")}
        >
          <div style={{ padding: "8px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <Semaforo status="red" />
              <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>Aguarda você</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "white", marginBottom: 2 }}>Proposta R$110k</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>João Silva · Closer enviou há 2h</div>
            <div style={{ display: "flex", gap: 4 }}>
              <ActionButton label="✓ Aprovar" />
              <ActionButton label="✗ Revisar" variant="danger" />
            </div>
          </div>
          {[
            { status: "yellow" as const, label: "Reforma SP",  valor: "R$65k", info: "Negociação · dia 3"  },
            { status: "green"  as const, label: "Marcenaria",  valor: "R$42k", info: "Match ativo · hoje"  },
            { status: "green"  as const, label: "Arquitetura", valor: "R$30k", info: "Proposta enviada"    },
          ].map((deal, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Semaforo status={deal.status} />
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{deal.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{deal.info}</div>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{deal.valor}</span>
            </div>
          ))}
          <div style={{ padding: "6px 0 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Meta semanal</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>R$94k / R$120k</span>
            </div>
            <ProgressBar value={94} max={120} color="#22c55e" />
          </div>
        </PanelItem>

        {/* HOMOLOGAÇÃO */}
        <PanelItem
          icon="🔍" label="Homologação" badge="5 pendentes" alertCount={2} severity="warning"
          isActive={active === "homologacao"} onToggle={() => toggle("homologacao")}
        >
          {[
            { nome: "Arq. Roberto Lima",    tipo: "Arquitetura",  dias: 3, status: "yellow" as const },
            { nome: "Eng. Ana Ferreira",    tipo: "Estrutural",   dias: 1, status: "yellow" as const },
            { nome: "Marcenaria Criativa",  tipo: "Marcenaria",   dias: 7, status: "red"    as const },
            { nome: "Design Interiores SP", tipo: "Decoração",    dias: 2, status: "yellow" as const },
            { nome: "Construção Rápida",    tipo: "Construção",   dias: 0, status: "green"  as const },
          ].map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Semaforo status={p.status} />
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{p.nome}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{p.tipo}</div>
                </div>
              </div>
              <span style={{ fontSize: 9, color: p.dias >= 5 ? "#ef4444" : p.dias >= 2 ? "#eab308" : "#22c55e" }}>
                {p.dias === 0 ? "novo" : `${p.dias}d`}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 6 }}><ActionButton label="Revisar pendentes" variant="warning" /></div>
        </PanelItem>

        {/* CRM */}
        <PanelItem
          icon="🗂️" label="CRM" badge="8 vencidos" alertCount={1} severity="warning"
          isActive={active === "crm"} onToggle={() => toggle("crm")}
        >
          <div style={{ padding: "7px", borderRadius: 6, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#eab308", fontWeight: 600, marginBottom: 2 }}>8 follow-ups vencidos</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>Leads sem contato há +48h</div>
            <ActionButton label="Disparar todos" variant="warning" />
          </div>
          {[
            { label: "Follow-ups hoje",  valor: "14",  color: "white"                 },
            { label: "Leads mornos",     valor: "23",  color: "#eab308"               },
            { label: "Leads frios",      valor: "45",  color: "rgba(255,255,255,0.4)" },
            { label: "Taxa contato",     valor: "93%", color: "#22c55e"               },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: m.color }}>{m.valor}</span>
            </div>
          ))}
        </PanelItem>

      </div>

      {/* LiveFeed — bottom strip */}
      {filteredFeed.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.05)", maxHeight: 110, overflowY: "auto" }} className="panel-scroll">
          <LiveFeed feed={filteredFeed} />
        </div>
      )}

      {/* Slide panels */}
      <SlidePanel
        title="Leads em Movimento" subtitle="Fila de atendimento em tempo real"
        items={LEADS_ITEMS} isOpen={slide === "leads"}
        onClose={() => setSlide(null)} onAgenteClick={onAgenteClick}
      />
      <SlidePanel
        title="Pós-Match — Negociações" subtitle="Oportunidades em andamento"
        items={MATCH_ITEMS} isOpen={slide === "pos-match"}
        onClose={() => setSlide(null)} onAgenteClick={onAgenteClick}
      />
      <SlidePanel
        title="Parceiros Ativos" subtitle="Base de parceiros homologados"
        items={PARCEIROS_ITEMS} isOpen={slide === "parceiros"}
        onClose={() => setSlide(null)} onAgenteClick={onAgenteClick}
      />
    </div>
  );
}
