"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OfficeCanvas, Agent } from "@/components/office/OfficeCanvas";
import { AgentBubble } from "@/components/office/AgentBubble";
import { AgentLogPanel } from "@/components/office/AgentLogPanel";
import { KpiBar } from "@/components/office/KpiBar";
import { MarketingPanel } from "@/components/office/MarketingPanel";
import { DetailModal } from "@/components/office/DetailModal";
import { ToastAlert } from "@/components/office/ToastAlert";
import { LivePulse } from "@/components/office/LivePulse";
import DecisionInbox from "@/components/office/DecisionInbox";
import CriticalBar from "@/components/office/CriticalBar";
import { useOfficeLife } from "@/hooks/useOfficeLife";
import { useAlerts } from "@/hooks/useAlerts";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useSupabaseLeads, type LeadComPessoa } from "@/hooks/useSupabaseLeads";
import LiveCrmPanel from "@/components/office/LiveCrmPanel";
import { type LiveLead } from "@/lib/data/live-leads";
import { DECISIONS_MOCK } from "@/lib/data/decisions-mock";
import { getLeadById } from "@/lib/data/leads-mock";
import { getPartnerById } from "@/lib/data/partners-mock";
import Lead360Drawer from "@/components/office/Lead360Drawer";
import Partner360Drawer from "@/components/office/Partner360Drawer";
import CriticalActionModal, { type CriticalActionModalProps } from "@/components/office/CriticalActionModal";
import MobileNav, { type MobileTab } from "@/components/office/MobileNav";
import MobileHeader from "@/components/office/MobileHeader";
import MobileKpiBar from "@/components/office/MobileKpiBar";
import MobileCriticalBar from "@/components/office/MobileCriticalBar";
import MobileCanvas from "@/components/office/MobileCanvas";
import MobileExperience from "@/components/office/MobileExperience";
import agentsData from "@/lib/data/agents-mock.json";
import type { AgentState } from "@/lib/agent-states";

const agents: Agent[] = agentsData.agents as Agent[];
const ONLINE_COUNT = agents.filter((a) => a.status.online).length;
const CRITICAL_COUNT = DECISIONS_MOCK.filter((d) => d.status === "critical").length;

function NotificationToast({ message }: { message: string }) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-2xl px-5 py-3 shadow-2xl"
      style={{
        background: "rgba(4,8,20,0.96)",
        border: "1px solid rgba(34,197,94,0.35)",
        backdropFilter: "blur(12px)",
        animation: "fadeSlideUp 0.3s ease",
        maxWidth: "520px",
        whiteSpace: "nowrap",
      }}
    >
      <p className="text-center text-[13px] font-medium" style={{ color: "#f0fdf4" }}>
        {message}
      </p>
    </div>
  );
}

function OfficePageInner() {
  const searchParams = useSearchParams();
  const isTvMode = searchParams.get("mode") === "tv";

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [hoveredState, setHoveredState] = useState<AgentState>("trabalhando");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [detailModal, setDetailModal] = useState<string | null>(null);
  const [horaAtual, setHoraAtual] = useState("");
  const [leadDrawerId, setLeadDrawerId] = useState<string | null>(null);
  const [partnerDrawerId, setPartnerDrawerId] = useState<string | null>(null);
  const [criticalModal, setCriticalModal] = useState<Omit<CriticalActionModalProps, "onConfirm" | "onCancel"> & { onConfirm: (j: string, a?: string) => void } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("inbox");
  const [rightPanel, setRightPanel] = useState<"crm" | "inbox">("crm");
  const [selectedLiveLead, setSelectedLiveLead] = useState<LiveLead | null>(null);
  const bp = useBreakpoint();
  const { leads: supaLeads, loading: leadsLoading, avancarFase: avancarFaseDB } = useSupabaseLeads();

  // Adapter: HubLead → LiveLead enquanto os componentes de canvas são migrados
  const HUB_FASE_TO_CANVAS: Record<string, LiveLead["fase"]> = {
    entrada: "entrando", espera: "aguardando", qualificacao: "qualificando",
    apresentacao: "qualificado", negociacao: "match_realizado",
    fechamento: "match_realizado", pos_venda: "saindo",
    perdido: "frio", ganho: "saindo",
  };
  const leads: LiveLead[] = supaLeads.map((l: LeadComPessoa) => ({
    id: l.id,
    numero: l.numero_visual,
    nome: l.hub_pessoas?.nome ?? "Lead",
    nome_curto: (l.hub_pessoas?.nome ?? "Lead").split(" ").slice(0, 2).join(" "),
    valor_estimado: l.valor_estimado ?? 0,
    tipo: (l.tipo === "imobiliario" ? "mercado_imobiliario" : l.tipo) as LiveLead["tipo"],
    fase: HUB_FASE_TO_CANVAS[l.fase] ?? "aguardando",
    sala_atual: (l.sala_canvas ?? "waiting_area") as LiveLead["sala_atual"],
    sala_destino: null,
    posicao: { x: l.posicao_x ?? 488, y: l.posicao_y ?? 482 },
    posicao_destino: null,
    tempo_na_fase_ms: 0,
    sla_target_ms: (l.sla_horas ?? 5) * 3600000,
    agente_responsavel_id: l.atendente_id,
    agente_responsavel_nome: l.atendente_id ? "SDR Alpha" : null,
    ultima_mensagem: null,
    mensagem_visivel: false,
    score_prioridade: l.score ?? 50,
    canal: "organico" as LiveLead["canal"],
    categoria: l.tipo,
    created_at: new Date(l.criado_em),
    movendo: false,
  }));

  const CANVAS_FASE_TO_HUB: Record<string, LiveLead["fase"]> = {
    aguardando: "espera", triagem: "qualificacao", qualificando: "qualificacao",
    qualificado: "apresentacao", match_realizado: "negociacao",
  } as unknown as Record<string, LiveLead["fase"]>;
  const avancarFase = useCallback((leadId: string) => {
    const raw = supaLeads.find((l) => l.id === leadId);
    if (!raw) return;
    const faseMap: Record<string, import("@/lib/supabase/client").HubLead["fase"]> = {
      espera: "qualificacao", qualificacao: "apresentacao",
      apresentacao: "negociacao", negociacao: "fechamento",
    };
    const novaFase = faseMap[raw.fase];
    if (novaFase) avancarFaseDB(leadId, novaFase, raw.sala_canvas).catch(console.error);
  }, [supaLeads, avancarFaseDB]);
  const removerLead = useCallback((_leadId: string) => {}, []);
  const marcarCritico = useCallback((_leadId: string) => {}, []);

  useEffect(() => {
    const tick = () =>
      setHoraAtual(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const {
    posOverridesRef, packetsRef, statesRef, stateTimestampsRef,
    particlesRef, connectionsRef, notification,
  } = useOfficeLife(agents);

  const { feed, newAlert, dismissNew } = useAlerts();

  const handleHover = useCallback((agent: Agent, mx: number, my: number) => {
    setHoveredAgent(agent);
    setHoveredState(statesRef.current[agent.id] ?? "trabalhando");
    setMousePos({ x: mx, y: my });
  }, [statesRef]);

  const handleLeave = useCallback(() => setHoveredAgent(null), []);

  const handleClick = useCallback((agent: Agent) => {
    setHoveredAgent(null);
    setSelectedAgent((prev) => (prev?.id === agent.id ? null : agent));
  }, []);

  const handleVerAgente = useCallback((agenteId: string) => {
    const agent = agents.find((a) => a.id === agenteId);
    if (agent) setSelectedAgent(agent);
  }, []);

  /* SHARED OVERLAYS — rendered on both mobile and desktop */
  const sharedOverlays = (
    <>
      {selectedAgent && (
        <AgentLogPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
      {detailModal && (
        <DetailModal area={detailModal} onClose={() => setDetailModal(null)} />
      )}
      {leadDrawerId && (() => { const lead = getLeadById(leadDrawerId); return lead ? <Lead360Drawer lead={lead} onClose={() => setLeadDrawerId(null)} /> : null; })()}
      {selectedLiveLead && (
        <Lead360Drawer
          lead={{
            id: selectedLiveLead.id,
            numero: selectedLiveLead.numero,
            nome: selectedLiveLead.nome,
            telefone: "—",
            email: "—",
            cidade: "São Paulo",
            estado: "SP",
            origem: selectedLiveLead.canal === "meta_ads" ? "Meta Ads" : selectedLiveLead.canal === "google_ads" ? "Google Ads" : selectedLiveLead.canal === "indicacao" ? "Indicação" : "Orgânico",
            campanha: selectedLiveLead.canal,
            status: selectedLiveLead.fase === "critico" ? "em_contato" : selectedLiveLead.fase === "qualificado" || selectedLiveLead.fase === "match_realizado" ? "qualificado" : "em_contato",
            intencao: selectedLiveLead.categoria === "reforma_completa" ? "reforma_completa" : selectedLiveLead.categoria === "construcao" ? "construcao" : selectedLiveLead.categoria === "decoracao" || selectedLiveLead.categoria === "marcenaria" ? "decoracao" : "reforma_parcial",
            urgencia: "1_3_meses",
            categoria: selectedLiveLead.valor_estimado >= 60000 ? "alto_valor" : selectedLiveLead.valor_estimado >= 30000 ? "medio_valor" : "baixo_valor",
            orcamento_estimado: selectedLiveLead.valor_estimado,
            descricao_projeto: selectedLiveLead.ultima_mensagem?.texto ?? "Lead ativo no escritório virtual.",
            prioridade: selectedLiveLead.score_prioridade,
            sla_tempo: Math.floor(selectedLiveLead.tempo_na_fase_ms / 60000),
            sla_meta: Math.floor(selectedLiveLead.sla_target_ms / 60000),
            fit_score: selectedLiveLead.score_prioridade,
            proxima_acao: selectedLiveLead.fase === "critico" ? "Acionar SDR imediatamente — SLA estourado" : "Continuar qualificação",
            notas: `Lead em fase: ${selectedLiveLead.fase}. Responsável: ${selectedLiveLead.agente_responsavel_nome ?? "Não atribuído"}.`,
            historico: selectedLiveLead.ultima_mensagem ? [{
              tipo: selectedLiveLead.ultima_mensagem.de === "agente" ? "ligacao" as const : "whatsapp" as const,
              texto: selectedLiveLead.ultima_mensagem.texto,
              agente: selectedLiveLead.ultima_mensagem.agente_nome ?? selectedLiveLead.nome,
              timestamp: selectedLiveLead.ultima_mensagem.timestamp.toISOString(),
            }] : [],
            criado_em: selectedLiveLead.created_at.toISOString(),
            atualizado_em: new Date().toISOString(),
          }}
          onClose={() => setSelectedLiveLead(null)}
          onAction={(acao) => {
            if (acao === "realizar_match") avancarFase(selectedLiveLead.id);
            if (acao === "marcar_perdido") removerLead(selectedLiveLead.id);
            if (acao === "escalar") marcarCritico(selectedLiveLead.id);
            setSelectedLiveLead(null);
          }}
        />
      )}
      {partnerDrawerId && (() => { const partner = getPartnerById(partnerDrawerId); return partner ? <Partner360Drawer partner={partner} onClose={() => setPartnerDrawerId(null)} /> : null; })()}
      {criticalModal && (
        <CriticalActionModal
          {...criticalModal}
          onConfirm={(j, a) => { criticalModal.onConfirm(j, a); setCriticalModal(null); }}
          onCancel={() => setCriticalModal(null)}
        />
      )}
      {notification && <NotificationToast message={notification} />}
      <ToastAlert alert={newAlert} onDismiss={dismissNew} />
    </>
  );

  /* MOBILE MODE */
  if (bp === "mobile") {
    return <MobileExperience />;
  }

  /* TV MODE */
  if (isTvMode) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#0f172a", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 52, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>obra10+</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Command Office — ao vivo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontFamily: "monospace", fontSize: 22, color: "#22c55e", fontWeight: 700 }}>{horaAtual}</span>
            <button
              onClick={() => { window.location.href = "/office"; }}
              style={{ padding: "6px 14px", borderRadius: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 12, cursor: "pointer" }}
            >
              ✕ Sair do Modo TV
            </button>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <OfficeCanvas
            agents={agents} selectedId={null} onAgentClick={() => {}}
            posOverridesRef={posOverridesRef} packetsRef={packetsRef}
            statesRef={statesRef} stateTimestampsRef={stateTimestampsRef}
            particlesRef={particlesRef} connectionsRef={connectionsRef}
          />
        </div>
        <div style={{ height: 48, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", flexShrink: 0 }}>
          <span style={{ color: "#22c55e", fontSize: 13 }}>🟢 {ONLINE_COUNT} online</span>
          <span style={{ color: "#60a5fa", fontSize: 13 }}>⚡ 62 leads hoje</span>
          <span style={{ color: "#22c55e", fontSize: 13 }}>✅ 24 qualificados</span>
          <span style={{ color: "#f59e0b", fontSize: 13 }}>💼 Match Rate 87%</span>
          <span style={{ color: "#a78bfa", fontSize: 13 }}>📊 ROAS 4.1x</span>
        </div>
        {notification && <NotificationToast message={notification} />}
      </div>
    );
  }

  /* NORMAL MODE */
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0f172a", display: "flex", flexDirection: "column" }}>

      {/* ZONA 1 — HEADER (56px) */}
      <div style={{
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, background: "rgba(15,23,42,0.95)", backdropFilter: "blur(12px)",
        position: "relative",
      }}>
        {/* Zona esquerda */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 1 }}>
          <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>obra10+</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>/ Command Office</span>
        </div>

        {/* Zona centro — LivePulse */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", height: "100%", display: "flex", alignItems: "center" }}>
          <LivePulse />
        </div>

        {/* Zona direita */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>{ONLINE_COUNT} online</span>
          </div>

          {CRITICAL_COUNT > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px #ef4444", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
                {CRITICAL_COUNT} crítico{CRITICAL_COUNT > 1 ? "s" : ""}
              </span>
            </div>
          )}

          <Link href="/crm" style={{
            background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
            borderRadius: 8, padding: "6px 14px", color: "#f97316",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}>
            CRM →
          </Link>
          <button
            onClick={() => { window.location.href = "/office?mode=tv"; }}
            style={{ padding: "3px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer" }}
          >
            📺 Modo TV
          </button>
        </div>
      </div>

      {/* ZONA 2 — BARRA CRÍTICA (44px, some quando vazia) */}
      <CriticalBar onVerInbox={() => {}} />

      {/* ZONA 3 — KPI BAR (44px) */}
      <KpiBar />

      {/* ZONA 4 — CORPO (3 colunas) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Esquerda — Marketing (260px) */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <MarketingPanel
            onVerTudo={(area) => setDetailModal(area)}
            feed={feed}
            onAgenteClick={handleVerAgente}
          />
        </div>

        {/* Centro — Canvas (flex) */}
        <div style={{ flex: 1, position: "relative", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <OfficeCanvas
            agents={agents}
            selectedId={selectedAgent?.id ?? null}
            onAgentClick={handleClick}
            onAgentHover={handleHover}
            onAgentLeave={handleLeave}
            posOverridesRef={posOverridesRef}
            packetsRef={packetsRef}
            statesRef={statesRef}
            stateTimestampsRef={stateTimestampsRef}
            particlesRef={particlesRef}
            connectionsRef={connectionsRef}
            liveLeads={leads}
            onLeadClick={setSelectedLiveLead}
          />
          {hoveredAgent && !selectedAgent && (
            <AgentBubble agent={hoveredAgent} state={hoveredState} x={mousePos.x} y={mousePos.y} />
          )}
        </div>

        {/* Direita — CRM / Decisões (300px) */}
        <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Tab toggle */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {([["crm", "CRM ao Vivo"], ["inbox", "Decisões"]] as const).map(([id, label]) => {
              const isActive = rightPanel === id;
              return (
                <button
                  key={id}
                  onClick={() => setRightPanel(id)}
                  style={{
                    flex: 1, padding: "7px 0", fontSize: 9, fontWeight: isActive ? 700 : 500,
                    color: isActive ? (id === "crm" ? "#22c55e" : "#ef4444") : "rgba(255,255,255,0.35)",
                    background: "transparent", border: "none",
                    borderBottom: isActive ? `2px solid ${id === "crm" ? "#22c55e" : "#ef4444"}` : "2px solid transparent",
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                    transition: "all 150ms",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {rightPanel === "crm" ? (
            <LiveCrmPanel
              leads={leads}
              onLeadClick={setSelectedLiveLead}
              onAvancarFase={avancarFase}
            />
          ) : (
            <DecisionInbox
              onVerAgente={handleVerAgente}
              onVerLead={(id) => setLeadDrawerId(id)}
              onVerParceiro={(id) => setPartnerDrawerId(id)}
            />
          )}
        </div>

      </div>

      {sharedOverlays}

    </div>
  );
}

export default function OfficePage() {
  return (
    <Suspense>
      <OfficePageInner />
    </Suspense>
  );
}
