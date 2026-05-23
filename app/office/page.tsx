"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Zap, Users, MessageSquare, Handshake, MailPlus, Bot, Settings, Bell, Building2, BarChart3, LayoutDashboard, ClipboardCheck } from "lucide-react";
import { Obra10BrandHeader } from "@/components/brand/Obra10Brand";
import { CrmSessionFooter } from "@/components/crm/CrmSessionFooter";
import { MAPA_AGENTES, CORES_AREA, TAMANHO_NIVEL, getInitials } from "@/lib/data/office-map";
import { MobileOfficeMap } from "@/components/office/MobileOfficeMap";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";

const panelLoading = (
  <div className="flex items-center justify-center p-6 text-xs" style={{ color: "#484f58" }}>
    Carregando…
  </div>
);

const DecisionPanel = dynamic(() => import("@/components/office/DecisionPanel"), {
  ssr: false,
  loading: () => panelLoading,
});

const LiveMessageFeed = dynamic(() => import("@/components/office/LiveMessageFeed"), {
  ssr: false,
  loading: () => null,
});

const FFTAgentNode = dynamic(() => import("@/components/office/FFTAgentNode"), {
  ssr: false,
  loading: () => null,
});

const FFTLeadNode = dynamic(() => import("@/components/office/FFTLeadNode"), {
  ssr: false,
  loading: () => null,
});

const AnalyticsPanel = dynamic(() => import("@/components/office/AnalyticsPanel"), {
  ssr: false,
  loading: () => panelLoading,
});

// Leads na área de espera + entrada (coordenadas % calibradas pelo office-map.json 1672×941)
// waiting_area nav(740,720)=44.3%,76.5%  main_entrance nav(850,840)=50.8%,89.3%
const POSICOES_LEADS = [
  { x: 40.5, y: 76.5 }, { x: 44.3, y: 76.5 }, { x: 48.0, y: 76.5 },
  { x: 40.5, y: 80.0 }, { x: 44.3, y: 80.0 }, { x: 48.0, y: 80.0 },
  { x: 44.3, y: 84.0 }, { x: 48.0, y: 84.0 },
];

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  estagio: string;
  valor_estimado: number;
  agente_responsavel?: string;
  humano_responsavel?: string;
  origem: string;
  criado_em: string;
  atualizado_em: string;
  metadata?: Record<string, unknown>;
}

interface Agente {
  agente_slug: string;
  nome: string;
  cargo: string;
  nivel: number;
  area: string;
  ativo: boolean;
}

export default function OfficePage() {
  const router = useRouter();
  const narrow = useNarrowViewport();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [metricas, setMetricas] = useState({ leadsAguardando: 0, aprovacoesPendentes: 0, leadsHoje: 0 });
  const [modoVisual, setModoVisual] = useState<"escritorio" | "analytics">("escritorio");
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const carregar = useCallback(async () => {
    const [l, a, aprov] = await Promise.all([
      supabase.from("hub_leads_crm").select("*")
        .not("estagio", "in", '("ganho","perdido","arquivado")')
        .order("atualizado_em", { ascending: false }).limit(20),
      supabase.from("hub_agente_identidade").select("agente_slug, nome, cargo, nivel, area, ativo")
        .order("nivel"),
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    ]);

    if (l.data) setLeads(l.data as Lead[]);
    if (a.data) setAgentes(a.data as Agente[]);
    const hoje = new Date().toDateString();
    setMetricas({
      leadsAguardando: (l.data || []).filter(x => !x.humano_responsavel).length,
      aprovacoesPendentes: aprov.count || 0,
      leadsHoje: (l.data || []).filter(x => new Date(x.criado_em).toDateString() === hoje).length,
    });
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("office-fft")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar]);

  function toggleModo(modo: "escritorio" | "analytics") {
    if (modo === modoVisual) return;
    setTransitioning(true);
    setTimeout(() => { setModoVisual(modo); setTransitioning(false); }, 200);
  }

  if (narrow === null) return null;
  if (narrow) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <MobileOfficeMap />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] md:h-screen overflow-hidden box-border bg-[#0a0a0a] md:p-3 md:gap-3">

      {/* ── SIDEBAR ESQUERDA (flutuante em desktop) ── */}
      <div
        className="flex-shrink-0 flex flex-col w-[200px] rounded-2xl border overflow-hidden md:self-stretch md:h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-1.5rem)]"
        style={{
          background: "#161b22",
          borderColor: "#30363d",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >

        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid #30363d" }}>
          <Obra10BrandHeader size="md" />
        </div>

        {/* Modo toggle */}
        <div className="p-3" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30363d" }}>
            {([
              { id: "escritorio" as const, label: "Office", Icon: Building2 },
              { id: "analytics" as const, label: "Analytics", Icon: BarChart3 },
            ]).map(m => (
              <button key={m.id} onClick={() => toggleModo(m.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: modoVisual === m.id ? "#003b26" : "transparent",
                  color: modoVisual === m.id ? "#c9a24a" : "#484f58",
                  border: "none", cursor: "pointer",
                }}>
                <m.Icon size={14} strokeWidth={1.5} className="flex-shrink-0" aria-hidden />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 p-3" style={{ borderBottom: "1px solid #30363d" }}>
          <button onClick={() => router.push("/crm/leads")} className="rounded-lg p-2 text-left hex-bg"
            style={{
              background: metricas.leadsAguardando > 0 ? "#c9a24a11" : "#21262d",
              border: `1px solid ${metricas.leadsAguardando > 0 ? "#c9a24a44" : "#30363d"}`,
            }}>
            <p className="text-xs" style={{ color: "#484f58" }}>Aguard.</p>
            <p className="font-black text-xl leading-none" style={{ color: metricas.leadsAguardando > 0 ? "#c9a24a" : "#e6edf3" }}>
              {metricas.leadsAguardando}
            </p>
          </button>
          <button onClick={() => router.push("/crm/aprovacoes")} className="rounded-lg p-2 text-left"
            style={{
              background: metricas.aprovacoesPendentes > 0 ? "#b3261e11" : "#21262d",
              border: `1px solid ${metricas.aprovacoesPendentes > 0 ? "#b3261e44" : "#30363d"}`,
            }}>
            <p className="text-xs" style={{ color: "#484f58" }}>Aprov.</p>
            <p className="font-black text-xl leading-none" style={{ color: metricas.aprovacoesPendentes > 0 ? "#b3261e" : "#e6edf3" }}>
              {metricas.aprovacoesPendentes}
            </p>
          </button>
        </div>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {[
            { secao: "VISÃO GERAL", items: [
              { label: "Dashboard", icon: Zap, rota: "/crm" },
              { label: "Analytics", icon: Zap, rota: "/crm/analytics" },
              { label: "Leads", icon: Users, rota: "/crm/leads" },
            ]},
            { secao: "ATENDIMENTO", items: [
              { label: "Inbox", icon: MessageSquare, rota: "/crm/atendimento" },
              { label: "Aprovações", icon: ClipboardCheck, rota: "/crm/aprovacoes" },
            ]},
            { secao: "PARCEIROS", items: [
              { label: "Parceiros", icon: Handshake, rota: "/crm/parceiros" },
              { label: "Convites", icon: MailPlus, rota: "/crm/parceiros/novo" },
            ]},
            { secao: "IA & SISTEMA", items: [
              { label: "Agentes IA", icon: Bot, rota: "/crm/agentes" },
              { label: "Automações", icon: Settings, rota: "/crm/ciclos" },
              { label: "Notificações", icon: Bell, rota: "/crm/contatos" },
              { label: "Integrações", icon: Settings, rota: "/crm/integracoes" },
            ]},
          ].map(grupo => (
            <div key={grupo.secao} className="mb-3">
              <p className="px-4 py-1 font-black tracking-widest" style={{ color: "#30363d", fontSize: "9px" }}>
                {grupo.secao}
              </p>
              {grupo.items.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.rota} onClick={() => router.push(item.rota)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left transition-all hover:bg-white hover:bg-opacity-5"
                    style={{ color: "#8b949e", border: "none", cursor: "pointer", background: "transparent" }}>
                    <Icon size={16} strokeWidth={1.5} className="flex-shrink-0 opacity-90" aria-hidden />
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-auto border-t" style={{ borderColor: "#30363d" }}>
          <CrmSessionFooter
            expanded
            primaryAction={{
              href: "/crm",
              label: "CRM completo",
              title: "Abrir CRM",
              icon: LayoutDashboard,
            }}
          />
        </div>
      </div>

      {/* ── ÁREA CENTRAL ── */}
      <div className="flex-1 relative overflow-hidden min-w-0">

        {/* MODO ESCRITÓRIO */}
        {modoVisual === "escritorio" && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ opacity: transitioning ? 0 : 1, transition: "opacity 0.2s ease", animation: !transitioning ? "office-enter 0.3s ease" : "none", background: "#0a0a0a" }}>

            {/* Container com aspect-ratio idêntico ao office-bg.png (1672×941).
                Garante que left/top em % batem exatamente com as coordenadas do JSON. */}
            <div className="relative" style={{ aspectRatio: "1672 / 941", width: "100%", maxHeight: "100%" }}>
              <img
                src="/sprites/office-bg.webp"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "fill" }}
                loading="eager"
                alt=""
              />

              {/* Agentes posicionados por cima do escritório 3D — coords calibradas pelo office-map.json */}
              {agentes.filter(a => a.ativo === true).map(agente => {
                const pos = MAPA_AGENTES[agente.agente_slug];
                if (!pos) return null;
                const leadsDoAgente = leads.filter(l => l.agente_responsavel === agente.agente_slug).length;
                const cor = CORES_AREA[agente.area] || "#c9a24a";
                const tamanho = TAMANHO_NIVEL[agente.nivel] || 24;
                return (
                  <FFTAgentNode
                    key={agente.agente_slug}
                    slug={agente.agente_slug}
                    nome={agente.cargo}
                    cargo={agente.cargo}
                    x={pos.x}
                    y={pos.y}
                    leadsAtivos={leadsDoAgente}
                    status={leadsDoAgente > 3 ? "critico" : leadsDoAgente > 0 ? "ocupado" : "ativo"}
                    cor={cor}
                    tamanho={tamanho}
                    ativoDb={agente.ativo}
                    iniciais={getInitials(agente.cargo)}
                  />
                );
              })}

              {/* Leads na área de espera / entrada */}
              {leads.slice(0, 8).map((lead, idx) => {
                const pos = POSICOES_LEADS[idx];
                if (!pos) return null;
                return (
                  <FFTLeadNode
                    key={lead.id}
                    id={lead.id}
                    nome={lead.nome}
                    mercado={(lead.metadata?.mercado as string) || "geral"}
                    estagio={lead.estagio}
                    valor={lead.valor_estimado}
                    x={pos.x}
                    y={pos.y}
                    atualizadoEm={lead.atualizado_em}
                    onClick={() => setLeadSelecionado(lead)}
                  />
                );
              })}

              {leads.length === 0 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                  <div className="fft-panel px-6 py-4 text-center">
                    <p className="text-white font-bold mb-1" style={{ letterSpacing: "0.1em" }}>ESCRITÓRIO TRANQUILO</p>
                    <p className="text-xs" style={{ color: "#484f58" }}>Nenhum lead ativo no momento</p>
                  </div>
                </div>
              )}

              <LiveMessageFeed />
            </div>
          </div>
        )}

        {/* MODO ANALYTICS */}
        {modoVisual === "analytics" && (
          <div className="absolute inset-0 overflow-hidden"
            style={{ opacity: transitioning ? 0 : 1, transition: "opacity 0.2s ease" }}>
            <AnalyticsPanel />
          </div>
        )}

        {/* Modal lead selecionado */}
        {leadSelecionado && (
          <div className="absolute inset-0 flex items-center justify-center z-40"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setLeadSelecionado(null)}>
            <div className="fft-panel p-4 w-72" onClick={e => e.stopPropagation()}>
              {/* Ornamentos de canto */}
              {[
                { top: 8, left: 8, borderT: true, borderL: true },
                { top: 8, right: 8, borderT: true, borderR: true },
                { bottom: 8, left: 8, borderB: true, borderL: true },
                { bottom: 8, right: 8, borderB: true, borderR: true },
              ].map((o, i) => (
                <div key={i} className="absolute"
                  style={{
                    width: 12, height: 12,
                    top: o.top, bottom: o.bottom, left: o.left, right: o.right,
                    borderTop: o.borderT ? "1px solid #c9a24a" : undefined,
                    borderBottom: o.borderB ? "1px solid #c9a24a" : undefined,
                    borderLeft: o.borderL ? "1px solid #c9a24a" : undefined,
                    borderRight: o.borderR ? "1px solid #c9a24a" : undefined,
                  }} />
              ))}

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold" style={{ letterSpacing: "0.05em" }}>
                  {leadSelecionado.nome.toUpperCase()}
                </h3>
                <button onClick={() => setLeadSelecionado(null)} style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>

              {/* Separador FFT */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px" style={{ background: "#c9a24a44" }} />
                <div className="w-1.5 h-1.5 rotate-45" style={{ background: "#c9a24a" }} />
                <div className="flex-1 h-px" style={{ background: "#c9a24a44" }} />
              </div>

              <div className="space-y-1.5 mb-4">
                {[
                  { label: "ESTÁGIO", value: leadSelecionado.estagio },
                  { label: "ORIGEM",  value: leadSelecionado.origem },
                  { label: "AGENTE",  value: leadSelecionado.agente_responsavel || "—" },
                  { label: "MERCADO", value: (leadSelecionado.metadata?.mercado as string) || "geral" },
                ].map(f => (
                  <div key={f.label} className="flex justify-between">
                    <span className="text-xs tracking-wider" style={{ color: "#484f58" }}>{f.label}</span>
                    <span className="text-xs font-bold" style={{ color: "#c9a24a" }}>{f.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { router.push(`/crm/leads/${leadSelecionado.id}`); setLeadSelecionado(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #003b26, #005c3d)", boxShadow: "0 0 10px rgba(0,59,38,0.4)", letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
                  💬 ATENDER
                </button>
                <button onClick={() => setLeadSelecionado(null)}
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: "#21262d", color: "#8b949e", border: "none", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DECISION PANEL DIREITO ── */}
      <div className="flex-shrink-0" style={{ width: "290px", borderLeft: "1px solid #30363d" }}>
        <DecisionPanel />
      </div>
    </div>
  );
}
