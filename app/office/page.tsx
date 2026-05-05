"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OfficeCanvas, Agent } from "@/components/office/OfficeCanvas";
import { AgentBubble } from "@/components/office/AgentBubble";
import { AgentLogPanel } from "@/components/office/AgentLogPanel";
import { ToastAlert } from "@/components/office/ToastAlert";
import { LivePulse } from "@/components/office/LivePulse";
import { CommandTop } from "@/components/office/CommandTop";
import { CriticalStrip } from "@/components/office/CriticalStrip";
import { DynamicKpis } from "@/components/office/DynamicKpis";
import { ContextMenu } from "@/components/office/ContextMenu";
import { DecisionPanel } from "@/components/office/DecisionPanel";
import { AgentsDrawer } from "@/components/office/AgentsDrawer";
import { OfficeFilters, type FiltroCanvas } from "@/components/office/OfficeFilters";
import { DetailModal } from "@/components/office/DetailModal";
import Lead360Drawer from "@/components/office/Lead360Drawer";
import Partner360Drawer from "@/components/office/Partner360Drawer";
import CriticalActionModal, { type CriticalActionModalProps } from "@/components/office/CriticalActionModal";
import MobileExperience from "@/components/office/MobileExperience";
import LiveMessageFeed from "@/components/office/LiveMessageFeed";
import Link from "next/link";
import { useOfficeLife } from "@/hooks/useOfficeLife";
import { useAlerts } from "@/hooks/useAlerts";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useSupabaseLeads, type LeadComPessoa } from "@/hooks/useSupabaseLeads";
import { type LiveLead } from "@/lib/data/live-leads";
import { getLeadById } from "@/lib/data/leads-mock";
import { getPartnerById } from "@/lib/data/partners-mock";
import type { AgentState } from "@/lib/agent-states";
import agentsData from "@/lib/data/agents-mock.json";

const agents: Agent[] = agentsData.agents as Agent[];

type Visao = "geral" | "atendimento" | "trafego" | "conteudo" | "sites" | "agentes" | "governanca" | "relatorios";

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

  const [visao, setVisao] = useState<Visao>("geral");
  const [filtroCanvas, setFiltroCanvas] = useState<FiltroCanvas>("todos");
  const [modoTV, setModoTV] = useState(isTvMode);
  const [agentsDrawerAberto, setAgentsDrawerAberto] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [hoveredState, setHoveredState] = useState<AgentState>("trabalhando");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [detailModal, setDetailModal] = useState<string | null>(null);
  const [leadDrawerId, setLeadDrawerId] = useState<string | null>(null);
  const [partnerDrawerId, setPartnerDrawerId] = useState<string | null>(null);
  const [criticalModal, setCriticalModal] = useState<Omit<CriticalActionModalProps, "onConfirm" | "onCancel"> & { onConfirm: (j: string, a?: string) => void } | null>(null);
  const [selectedLiveLead, setSelectedLiveLead] = useState<LiveLead | null>(null);

  const bp = useBreakpoint();
  const { leads: supaLeads, avancarFase: avancarFaseDB } = useSupabaseLeads();

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

  const {
    posOverridesRef, packetsRef, statesRef, stateTimestampsRef,
    particlesRef, connectionsRef, notification,
  } = useOfficeLife(agents);

  const { newAlert, dismissNew } = useAlerts();

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

  const sharedOverlays = (
    <>
      {selectedAgent && (
        <AgentLogPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
      {detailModal && (
        <DetailModal area={detailModal} onClose={() => setDetailModal(null)} />
      )}
      {leadDrawerId && (() => {
        const lead = getLeadById(leadDrawerId);
        return lead ? <Lead360Drawer lead={lead} onClose={() => setLeadDrawerId(null)} /> : null;
      })()}
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
      {partnerDrawerId && (() => {
        const partner = getPartnerById(partnerDrawerId);
        return partner ? <Partner360Drawer partner={partner} onClose={() => setPartnerDrawerId(null)} /> : null;
      })()}
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

  if (bp === "mobile") {
    return <MobileExperience />;
  }

  /* TV MODE */
  if (modoTV) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#0f172a", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 52, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>obra10+</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Command Office — ao vivo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <LivePulse />
            <button
              onClick={() => setModoTV(false)}
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
        {notification && <NotificationToast message={notification} />}
      </div>
    );
  }

  /* NORMAL MODE */
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-gray-950">

      {/* CommandTop */}
      <CommandTop
        visao={visao}
        onResolverAgora={() => setAgentsDrawerAberto(false)}
        onAbrirAgentes={() => setAgentsDrawerAberto(true)}
        onModoTV={() => setModoTV(true)}
        modoTV={modoTV}
      />

      {/* CriticalStrip */}
      <CriticalStrip />

      {/* DynamicKpis */}
      <DynamicKpis visao={visao} />

      {/* Body: 3 columns */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left: ContextMenu (208px) */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <ContextMenu visao={visao} onVisaoChange={setVisao} />
        </div>

        {/* Center: Canvas + Filters */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <OfficeFilters filtro={filtroCanvas} onFiltroChange={setFiltroCanvas} />
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
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
        </div>

        {/* Right: DecisionPanel (288px) */}
        <div className="w-72 flex-shrink-0 overflow-hidden" style={{ borderLeft: "1px solid #e0ddd6" }}>
          <DecisionPanel />
        </div>

      </div>

      {/* Agents overlay drawer */}
      <AgentsDrawer
        aberto={agentsDrawerAberto}
        onFechar={() => setAgentsDrawerAberto(false)}
        onAgenteClick={(agent) => {
          setAgentsDrawerAberto(false);
          handleClick(agent);
        }}
      />

      {/* CRM NAV — fixed top-right */}
      <div className="fixed top-3 right-4 z-40 flex items-center gap-2">
        <Link href="/crm/leads" className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors"
          style={{ background: "rgba(201,162,74,0.15)", color: "#c9a24a", border: "1px solid rgba(201,162,74,0.3)" }}>
          Pipeline
        </Link>
        <Link href="/crm/atendimento" className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors"
          style={{ background: "rgba(0,59,38,0.4)", color: "#34d399", border: "1px solid rgba(0,59,38,0.6)" }}>
          Atendimento
        </Link>
        <Link href="/crm/aprovacoes" className="text-xs px-3 py-1.5 rounded-full font-bold transition-colors"
          style={{ background: "rgba(179,38,30,0.15)", color: "#f87171", border: "1px solid rgba(179,38,30,0.3)" }}>
          Aprovações
        </Link>
      </div>

      <LiveMessageFeed />
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
