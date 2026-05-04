"use client";

import { useState } from "react";
import { ProgressBar, Semaforo, ActionButton } from "./PanelComponents";
import { PanelItem } from "./PanelItem";
import { SlidePanel, SlidePanelItem } from "./SlidePanel";
import { LiveFeed } from "./LiveFeed";
import { Alert } from "@/lib/alerts-system";

interface MarketingPanelProps {
  onVerTudo: (area: string) => void;
  feed?: Alert[];
  onAgenteClick?: (agenteId: string) => void;
}

const CAMPANHAS_ITEMS: SlidePanelItem[] = [
  {
    id: "c1", titulo: "META ADS — CPL alto",
    subtitulo: "CPL R$89 vs meta R$60 · 34 leads · ROAS 3.8x", severity: "critical",
    alert: {
      id: "alt-001", severity: "critical", area: "campanhas",
      titulo: "CPL acima da meta",
      descricao: "Conjunto B gastando sem eficiência. CPL 48% acima da meta. Recomendação: revisar campanha e redistribuir budget para Google.",
      acao_label: "Revisar campanha", acao_tipo: "pausar_campanha", acao_dados: {},
      agente_id: "ag-010", timestamp: new Date(Date.now() - 12 * 60 * 1000), resolvido: false,
    },
    agente_id: "ag-010",
  },
  {
    id: "c2", titulo: "GOOGLE ADS — ok",
    subtitulo: "CPL R$64 vs meta R$60 · 28 leads · ROAS 4.2x", severity: "ok",
    alert: {
      id: "alt-007", severity: "info", area: "campanhas",
      titulo: "Google Ads estável",
      descricao: "Performance dentro da meta. Crescimento de 8% vs ontem. ROAS acima do benchmark.",
      timestamp: new Date(Date.now() - 30 * 60 * 1000), resolvido: false,
    },
    agente_id: "ag-011",
  },
];

const CRIACAO_ITEMS: SlidePanelItem[] = [
  {
    id: "cr1", titulo: "Reel reforma — aguardando material",
    subtitulo: "Motion IA · Prazo: 2 dias", severity: "warning",
    alert: {
      id: "alt-006", severity: "warning", area: "criacao",
      titulo: "Material não recebido",
      descricao: "Lead deveria ter enviado fotos do projeto. Já passaram 2 dias. Risco de atraso.",
      acao_label: "Solicitar material", acao_tipo: "solicitar_material", acao_dados: {},
      agente_id: "ag-015", timestamp: new Date(Date.now() - 45 * 60 * 1000), resolvido: false,
    },
    agente_id: "ag-015", tarefa_id: "task-reel-reforma",
  },
  { id: "cr2", titulo: "Copy Meta Ads — em andamento", subtitulo: "Copy Alpha · Hoje 18h · 80% concluído", severity: "warning", agente_id: "ag-012", tarefa_id: "task-copy-meta" },
  { id: "cr3", titulo: "Landing Page — entregue", subtitulo: "Design Beta · Entregue", severity: "ok", agente_id: "ag-014" },
];

const hasCriticalCampanha = CAMPANHAS_ITEMS.some((item) => item.severity === "critical");

export function MarketingPanel({ onVerTudo, feed = [], onAgenteClick }: MarketingPanelProps) {
  const [active, setActive] = useState<string>(hasCriticalCampanha ? "campanhas" : "");
  const [slide, setSlide] = useState<string | null>(null);

  const toggle = (id: string) => setActive((prev) => (prev === id ? "" : id));

  const filteredFeed = feed.filter((a) => ["marketing", "campanhas", "criacao"].includes(a.area));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(59,130,246,0.02)" }}>

      {/* Panel header */}
      <div style={{
        height: 28, padding: "0 12px", display: "flex", alignItems: "center",
        flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(59,130,246,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Marketing
        </span>
      </div>

      {/* Accordion items — fill remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* CAMPANHAS */}
        <PanelItem
          icon="📢" label="Campanhas" badge={2} alertCount={1} severity="critical"
          isActive={active === "campanhas"} onToggle={() => toggle("campanhas")}
          onVerTudo={() => setSlide("campanhas")}
        >
          {/* CPL acima da meta — alerta no topo */}
          <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 11 }}>🔴</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>
                Meta Ads — CPL R$89 (meta R$60)
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
              Tráfego Beta recomenda revisar conjunto B e redistribuir
            </div>
            <ActionButton label="Revisar campanha" variant="danger" />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Budget diário</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>R$4.2k / R$6k</span>
            </div>
            <ProgressBar value={4200} max={6000} color="#60a5fa" />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "right", marginTop: 2 }}>70% utilizado</div>
          </div>
        </PanelItem>

        {/* CRIAÇÃO */}
        <PanelItem
          icon="✍️" label="Criação" badge="8"
          isActive={active === "criacao"} onToggle={() => toggle("criacao")}
          onVerTudo={() => setSlide("criacao")}
        >
          {[
            { status: "🔄", label: "Copy Meta Ads",   agent: "Copy Alpha",  prazo: "hoje 18h", pct: 80,  alert: false },
            { status: "⏳", label: "Criativo Google", agent: "Design Alpha", prazo: "amanhã",   pct: 0,   alert: false },
            { status: "✅", label: "Landing Page",    agent: "Design Beta",  prazo: "entregue", pct: 100, alert: false },
            { status: "⏳", label: "Reel reforma",    agent: "Motion IA",    prazo: "2 dias",   pct: 0,   alert: true  },
          ].map((task, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10 }}>{task.status}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{task.label}</span>
                </div>
                <span style={{ fontSize: 9, color: task.prazo === "hoje 18h" ? "#eab308" : task.prazo === "entregue" ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                  {task.prazo}
                </span>
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{task.agent}</div>
              {task.pct > 0 && task.pct < 100 && <ProgressBar value={task.pct} max={100} color="#60a5fa" />}
              {task.alert && <div style={{ marginTop: 4 }}><ActionButton label="Solicitar material" variant="warning" /></div>}
            </div>
          ))}
        </PanelItem>

        {/* CONTEÚDO */}
        <PanelItem
          icon="📱" label="Conteúdo" badge="orgânico"
          isActive={active === "conteudo"} onToggle={() => toggle("conteudo")}
        >
          {[
            { label: "Posts hoje",   valor: "4",    meta: "6",   color: "#eab308" },
            { label: "Engajamento",  valor: "4.2%", meta: "4%",  color: "#22c55e" },
            { label: "Salvamentos",  valor: "847",  meta: "500", color: "#22c55e" },
            { label: "Leads org.",   valor: "8",    meta: "10",  color: "#eab308" },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{m.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{m.valor}</span>
                <span style={{ fontSize: 9, color: m.color }}>meta {m.meta}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Agendados semana</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>12/20</span>
            </div>
            <ProgressBar value={12} max={20} color="#8b5cf6" />
          </div>
        </PanelItem>

        {/* PERFORMANCE */}
        <PanelItem
          icon="📊" label="Performance"
          isActive={active === "performance"} onToggle={() => toggle("performance")}
        >
          {[
            { label: "ROAS total",    valor: "4.1x",   meta: "3x",    color: "#22c55e", ok: true  },
            { label: "CPL médio",     valor: "R$76",   meta: "R$60",  color: "#ef4444", ok: false },
            { label: "Imp. / lead",   valor: "124",    meta: "—",     color: "white",   ok: true  },
            { label: "CTR médio",     valor: "2.8%",   meta: "2%",    color: "#22c55e", ok: true  },
            { label: "Conv. rate",    valor: "0.8%",   meta: "1%",    color: "#eab308", ok: false },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Semaforo status={m.ok ? "green" : m.color === "#ef4444" ? "red" : "yellow"} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{m.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.valor}</span>
                {m.meta !== "—" && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>meta {m.meta}</span>}
              </div>
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
        title="Campanhas — Detalhe" subtitle="Visão completa das campanhas ativas"
        items={CAMPANHAS_ITEMS} isOpen={slide === "campanhas"}
        onClose={() => setSlide(null)} onAgenteClick={onAgenteClick}
      />
      <SlidePanel
        title="Criação — Detalhe" subtitle="Tarefas criativas em andamento"
        items={CRIACAO_ITEMS} isOpen={slide === "criacao"}
        onClose={() => setSlide(null)} onAgenteClick={onAgenteClick}
      />
    </div>
  );
}
