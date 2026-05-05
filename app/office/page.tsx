"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DecisionPanel from "@/components/office/DecisionPanel";
import LiveMessageFeed from "@/components/office/LiveMessageFeed";
import MobileExperience from "@/components/office/MobileExperience";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Agentes REAIS do banco — slugs fixos
const AGENTES_CANVAS = [
  { slug: "sdr", label: "SDR", x: 505, y: 568, cor: "#003b26" },
  { slug: "atendente", label: "Atendente", x: 460, y: 640, cor: "#003b26" },
  { slug: "gerente_atendimento", label: "Gerente", x: 840, y: 295, cor: "#c9a24a" },
  { slug: "ariane", label: "Diretora", x: 460, y: 340, cor: "#c9a24a" },
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
  ativo: boolean;
}

interface Metricas {
  leadsAguardando: number;
  aprovacoesPendentes: number;
  conversasAtivas: number;
  leadsHoje: number;
}

function tempoRelativo(data: string) {
  const diff = (Date.now() - new Date(data).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min`;
  return `${Math.round(diff / 60)}h`;
}

function urgenciaCor(data: string) {
  const mins = (Date.now() - new Date(data).getTime()) / 60000;
  if (mins > 15) return "#b3261e";
  if (mins > 5) return "#c9a24a";
  return "#003b26";
}

export default function OfficePage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({ leadsAguardando: 0, aprovacoesPendentes: 0, conversasAtivas: 0, leadsHoje: 0 });
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const carregar = useCallback(async () => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    const [l, a, aprov, msgs] = await Promise.all([
      supabase.from("hub_leads_crm").select("*")
        .not("estagio", "in", '("ganho","perdido")')
        .order("atualizado_em", { ascending: false })
        .limit(20),
      supabase.from("hub_agente_identidade").select("agente_slug, nome, cargo, nivel, ativo")
        .eq("ativo", true).order("nivel"),
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("hub_fila_mensagens").select("id").eq("direcao", "entrada").eq("status", "pendente"),
    ]);

    if (l.data) setLeads(l.data as Lead[]);
    if (a.data) setAgentes(a.data as Agente[]);

    const todosLeads = l.data || [];
    const aguardando = todosLeads.filter((x: Lead) => !x.humano_responsavel).length;
    const leadsHoje = todosLeads.filter((x: Lead) => new Date(x.criado_em) >= hoje).length;

    setMetricas({
      leadsAguardando: aguardando,
      aprovacoesPendentes: aprov.count || 0,
      conversasAtivas: (msgs.data || []).length,
      leadsHoje,
    });
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("office-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar]);

  if (isMobile) return <MobileExperience />;

  const SIDEBAR_ITENS = [
    {
      secao: "geral",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "⚡", badge: 0, acao: () => router.push("/crm") },
        { id: "pipeline", label: "Pipeline", icon: "👥", badge: metricas.leadsHoje, acao: () => router.push("/crm/leads") },
        { id: "agentes", label: "Agentes", icon: "🤖", badge: agentes.length, acao: () => router.push("/crm/agentes") },
      ]
    },
    {
      secao: "atendimento",
      items: [
        { id: "aguardando", label: "Aguardando resposta", icon: "💬", badge: metricas.leadsAguardando, acao: () => router.push("/crm/atendimento") },
        { id: "atendimento", label: "Atendimento ativo", icon: "🎧", badge: metricas.conversasAtivas, acao: () => router.push("/crm/atendimento") },
      ]
    },
    {
      secao: "decisoes",
      items: [
        { id: "aprovacoes", label: "Aprovações", icon: "✅", badge: metricas.aprovacoesPendentes, acao: () => router.push("/crm/aprovacoes") },
      ]
    },
    {
      secao: "configuracao",
      items: [
        { id: "novo_agente", label: "Novo agente", icon: "➕", badge: 0, acao: () => router.push("/crm/agentes/novo") },
        { id: "parceiros", label: "Parceiros", icon: "🤝", badge: 0, acao: () => router.push("/crm/parceiros") },
        { id: "contatos", label: "Notificações", icon: "🔔", badge: 0, acao: () => router.push("/crm/contatos") },
      ]
    },
  ];

  const SECAO_LABELS: Record<string, string> = {
    geral: "GERAL",
    atendimento: "ATENDIMENTO",
    decisoes: "DECISÕES",
    configuracao: "CONFIGURAÇÃO",
  };

  const POSICOES_LEADS = [
    { x: 505, y: 660 }, { x: 620, y: 660 }, { x: 740, y: 660 },
    { x: 860, y: 660 }, { x: 980, y: 660 }, { x: 505, y: 720 },
    { x: 620, y: 720 }, { x: 740, y: 720 },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0d1117" }}>

      {/* SIDEBAR ESQUERDA */}
      <div className="flex-shrink-0 flex flex-col" style={{ width: "220px", background: "#161b22", borderRight: "1px solid #30363d" }}>
        {/* LOGO */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: "#003b26" }}>O+</div>
            <div>
              <p className="text-white font-black text-sm leading-none">OBRA10+</p>
              <p className="text-xs leading-none" style={{ color: "#8b949e" }}>Escritório</p>
            </div>
          </div>
        </div>

        {/* MÉTRICAS REAIS */}
        <div className="grid grid-cols-2 gap-2 p-3" style={{ borderBottom: "1px solid #30363d" }}>
          <button onClick={() => router.push("/crm/leads")}
            className="rounded-lg p-2 text-left transition-colors hover:opacity-80"
            style={{ background: metricas.leadsAguardando > 0 ? "#c9a24a22" : "#21262d", border: `1px solid ${metricas.leadsAguardando > 0 ? "#c9a24a44" : "#30363d"}` }}>
            <p className="text-xs" style={{ color: "#8b949e" }}>Aguardando</p>
            <p className="font-black text-lg leading-none" style={{ color: metricas.leadsAguardando > 0 ? "#c9a24a" : "#e6edf3" }}>
              {metricas.leadsAguardando}
            </p>
          </button>
          <button onClick={() => router.push("/crm/aprovacoes")}
            className="rounded-lg p-2 text-left transition-colors hover:opacity-80"
            style={{ background: metricas.aprovacoesPendentes > 0 ? "#b3261e22" : "#21262d", border: `1px solid ${metricas.aprovacoesPendentes > 0 ? "#b3261e44" : "#30363d"}` }}>
            <p className="text-xs" style={{ color: "#8b949e" }}>Aprovações</p>
            <p className="font-black text-lg leading-none" style={{ color: metricas.aprovacoesPendentes > 0 ? "#b3261e" : "#e6edf3" }}>
              {metricas.aprovacoesPendentes}
            </p>
          </button>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="flex-1 overflow-y-auto py-2">
          {SIDEBAR_ITENS.map(secao => (
            <div key={secao.secao} className="mb-3">
              <p className="px-4 py-1 text-xs font-bold tracking-wider" style={{ color: "#484f58" }}>
                {SECAO_LABELS[secao.secao]}
              </p>
              {secao.items.map(item => (
                <button key={item.id} onClick={item.acao}
                  className="w-full flex items-center justify-between px-4 py-2 text-left transition-colors hover:bg-white hover:bg-opacity-5"
                  style={{ color: "#8b949e" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        background: item.id === "aprovacoes" ? "#b3261e" : "#003b26",
                        color: item.id === "aprovacoes" ? "white" : "#c9a24a",
                        minWidth: "20px", textAlign: "center",
                      }}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* LINK CRM BOTTOM */}
        <div className="p-3" style={{ borderTop: "1px solid #30363d" }}>
          <button onClick={() => router.push("/crm")} className="w-full py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "#003b26", color: "#c9a24a" }}>
            Abrir CRM completo →
          </button>
        </div>
      </div>

      {/* CANVAS PRINCIPAL */}
      <div className="flex-1 relative overflow-hidden">

        {/* IMAGEM DE FUNDO */}
        <div className="absolute inset-0">
          <img src="/sprites/bg-office.png" alt="Escritório"
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
          <div className="absolute inset-0" style={{ background: "rgba(13,17,23,0.4)" }} />
        </div>

        {/* AGENTES REAIS NO CANVAS */}
        {AGENTES_CANVAS.map(pos => {
          const agente = agentes.find(a => a.agente_slug === pos.slug);
          if (!agente) return null;
          return (
            <button key={pos.slug}
              onClick={() => router.push(`/crm/agentes/${pos.slug}`)}
              className="absolute flex flex-col items-center gap-1 transition-transform hover:scale-110"
              style={{ left: `${pos.x}px`, top: `${pos.y}px`, transform: "translate(-50%, -50%)" }}>
              <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-white shadow-lg animate-pulse"
                style={{ background: pos.cor, borderColor: pos.cor }}>
                {agente.nome.charAt(0)}
              </div>
              <div className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: "rgba(13,17,23,0.8)", color: pos.cor, border: `1px solid ${pos.cor}44` }}>
                {agente.nome}
              </div>
            </button>
          );
        })}

        {/* LEADS REAIS NO CANVAS */}
        {leads.slice(0, 8).map((lead, idx) => {
          const pos = POSICOES_LEADS[idx];
          if (!pos) return null;
          const cor = urgenciaCor(lead.atualizado_em);
          return (
            <button key={lead.id}
              onClick={() => setLeadSelecionado(lead)}
              className="absolute flex flex-col items-center gap-1 transition-transform hover:scale-110"
              style={{ left: `${pos.x}px`, top: `${pos.y}px`, transform: "translate(-50%, -50%)" }}>
              <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-white shadow-lg"
                style={{ background: "#0d1117", borderColor: cor }}>
                {lead.nome.charAt(0).toUpperCase()}
              </div>
              <div className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: "rgba(13,17,23,0.8)", color: cor, border: `1px solid ${cor}44`, maxWidth: "80px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lead.nome.split(" ")[0]}
              </div>
              <div className="text-xs font-bold" style={{ color: cor }}>{tempoRelativo(lead.atualizado_em)}</div>
            </button>
          );
        })}

        {/* ESTADO VAZIO */}
        {leads.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center p-6 rounded-2xl" style={{ background: "rgba(13,17,23,0.8)", border: "1px solid #30363d" }}>
              <p className="text-2xl mb-2">✓</p>
              <p className="text-white font-bold mb-1">Escritório tranquilo</p>
              <p className="text-sm" style={{ color: "#8b949e" }}>Nenhum lead ativo no momento</p>
            </div>
          </div>
        )}

        {/* FEED DE MENSAGENS AO VIVO */}
        <LiveMessageFeed />

        {/* MODAL LEAD SELECIONADO */}
        {leadSelecionado && (
          <div className="absolute inset-0 flex items-center justify-center z-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setLeadSelecionado(null)}>
            <div className="rounded-2xl p-4 w-80" style={{ background: "#161b22", border: "1px solid #30363d" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold">{leadSelecionado.nome}</h3>
                <button onClick={() => setLeadSelecionado(null)} style={{ color: "#8b949e" }}>✕</button>
              </div>
              <div className="space-y-1 mb-4 text-sm" style={{ color: "#8b949e" }}>
                {leadSelecionado.telefone && <p>📱 {leadSelecionado.telefone}</p>}
                <p>📍 {leadSelecionado.estagio}</p>
                <p>📌 {leadSelecionado.origem}</p>
                {leadSelecionado.valor_estimado > 0 && (
                  <p>💰 R$ {(leadSelecionado.valor_estimado / 1000).toFixed(0)}k</p>
                )}
                <p>⏱ {tempoRelativo(leadSelecionado.atualizado_em)}</p>
                {leadSelecionado.agente_responsavel && (
                  <p>🤖 {leadSelecionado.agente_responsavel}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { router.push(`/crm/leads/${leadSelecionado.id}`); setLeadSelecionado(null); }}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: "#003b26" }}>
                  💬 Ver conversa
                </button>
                <button onClick={() => { router.push("/crm/atendimento"); setLeadSelecionado(null); }}
                  className="flex-1 py-2 rounded-xl text-sm"
                  style={{ background: "#21262d", color: "#c9a24a" }}>
                  Atender →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DECISION PANEL DIREITO */}
      <div className="flex-shrink-0" style={{ width: "300px", borderLeft: "1px solid #30363d" }}>
        <DecisionPanel />
      </div>
    </div>
  );
}
