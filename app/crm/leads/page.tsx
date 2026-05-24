"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

// ─── Types ────────────────────────────────────────────────────────────────────

type Estagio = "novo" | "qualificando" | "qualificado" | "proposta" | "negociando" | "fechamento" | "ganho" | "perdido";

type Lead = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  estagio: Estagio;
  score: number;
  valor_estimado: number;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  motivo_perda: string | null;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  pessoa_id?: string | null;
  codigo?: string | null;
  /** Enriquecimento (hub_pessoas) — só leitura na UI */
  _pessoa_codigo?: string | null;
  _email_exibicao?: string | null;
};

type Atividade = {
  id: string;
  tipo: string;
  descricao: string;
  feito_por: string;
  feito_por_tipo: string;
  criado_em: string;
};

type Nota = {
  id: string;
  conteudo: string;
  criado_por: string;
  criado_em: string;
};

type Memoria = {
  id: string;
  chave: string;
  valor: string;
  confianca: number;
  criado_em: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTAGIOS = [
  { id: "novo",         label: "Novos",        color: "#6B7280" },
  { id: "qualificando", label: "Qualificando",  color: "#3B82F6" },
  { id: "qualificado",  label: "Qualificado",   color: "#06B6D4" },
  { id: "proposta",     label: "Proposta",      color: "#EAB308" },
  { id: "negociando",   label: "Negociando",    color: "#F97316" },
  { id: "fechamento",   label: "Fechamento",    color: "#A855F7" },
  { id: "ganho",        label: "✓ Ganhos",      color: "#22C55E" },
  { id: "perdido",      label: "✗ Perdidos",    color: "#EF4444" },
] as const;

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", meta_ads: "Meta Ads",
  google_ads: "Google Ads", linkedin: "LinkedIn", site: "Site",
  indicacao: "Indicação", outro: "Outro",
};
const ORIGENS_COLOR: Record<string, string> = {
  whatsapp: "#25D366", instagram: "#E1306C", meta_ads: "#1877F2",
  google_ads: "#EA4335", linkedin: "#0A66C2", site: "#6366F1",
  indicacao: "#F59E0B", outro: "#6B7280",
};
const ATIVIDADE_ICON: Record<string, string> = {
  mensagem: "💬", ligacao: "📞", email: "📧", reuniao: "📅",
  nota: "📝", proposta: "📄", follow_up: "🔄", status_change: "📍", ia_acao: "🤖",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
}

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function borderColor(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 5) return "#22C55E";
  if (m < 15) return "#EAB308";
  return "#EF4444";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [tabDetalhe, setTabDetalhe] = useState<"info" | "timeline" | "notas" | "memorias">("info");
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [memorias, setMemorias] = useState<Memoria[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [confirmandoPerda, setConfirmandoPerda] = useState(false);
  const [leadDragId, setLeadDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const vw = await supabase
      .from("vw_hub_leads_crm_enriquecido")
      .select("*")
      .order("criado_em", { ascending: false });

    if (!vw.error && vw.data) {
      const merged: Lead[] = (vw.data as Record<string, unknown>[]).map((r) => {
        const {
          pessoa_codigo,
          pessoa_nome_completo: _pn,
          email_exibicao,
          pessoa_cidade: _pc,
          pessoa_estado: _pe,
          ultima_mensagem_fila: _umf,
          ultima_mensagem_fila_em: _umfe,
          ...base
        } = r;
        const emailDisp =
          email_exibicao != null && String(email_exibicao).trim()
            ? String(email_exibicao).trim()
            : null;
        return {
          ...(base as Omit<Lead, "_pessoa_codigo" | "_email_exibicao">),
          _pessoa_codigo: pessoa_codigo != null ? String(pessoa_codigo) : null,
          _email_exibicao: emailDisp,
        };
      });
      setLeads(merged);
      return;
    }

    const { data } = await supabase.from("hub_leads_crm").select("*").order("criado_em", { ascending: false });
    const raw = (data || []) as Lead[];
    const pids = [...new Set(raw.map((r) => r.pessoa_id).filter(Boolean))] as string[];
    const map = new Map<string, { codigo: string | null; email: string | null }>();
    if (pids.length) {
      const { data: pes } = await supabase.from("hub_pessoas").select("id, codigo, email").in("id", pids);
      for (const p of pes || []) {
        map.set(String(p.id), {
          codigo: p.codigo != null ? String(p.codigo) : null,
          email: p.email != null ? String(p.email) : null,
        });
      }
    }
    const merged: Lead[] = raw.map((r) => {
      const pe = r.pessoa_id ? map.get(r.pessoa_id) : undefined;
      const emailLead = (r.email && String(r.email).trim()) || "";
      const emailP = (pe?.email && String(pe.email).trim()) || "";
      return {
        ...r,
        _pessoa_codigo: pe?.codigo ?? null,
        _email_exibicao: emailLead || emailP || null,
      };
    });
    setLeads(merged);
  }, []);

  useEffect(() => {
    const est = searchParams.get("estagio");
    const v = searchParams.get("view");
    if (est) setFiltroEstagio(est);
    if (v === "kanban" || v === "lista") setView(v);
    else if (isMobile) setView("lista");
  }, [searchParams, isMobile]);

  useEffect(() => {
    carregar();
    const ch = supabase.channel("leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  async function abrirDetalhe(lead: Lead) {
    setDetalhe(lead);
    setTabDetalhe("info");
    setConfirmandoPerda(false);
    setMotivoPerda("");
    const [{ data: a }, { data: n }, { data: m }] = await Promise.all([
      supabase.from("hub_atividades").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }).limit(30),
      supabase.from("hub_notas").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }),
      supabase.from("hub_memorias_lead").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }),
    ]);
    setAtividades((a || []) as Atividade[]);
    setNotas((n || []) as Nota[]);
    setMemorias((m || []) as Memoria[]);
  }

  async function moverEstagio(leadId: string, novoEstagio: string) {
    await supabase.from("hub_leads_crm").update({ estagio: novoEstagio, atualizado_em: new Date().toISOString() }).eq("id", leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, estagio: novoEstagio as Estagio } : l));
    if (detalhe?.id === leadId) setDetalhe(d => d ? { ...d, estagio: novoEstagio as Estagio } : null);
  }

  async function marcarGanho() {
    if (!detalhe) return;
    await moverEstagio(detalhe.id, "ganho");
    await supabase.from("hub_atividades").insert({ lead_id: detalhe.id, tipo: "status_change", descricao: "Lead marcado como GANHO", feito_por: "humano", feito_por_tipo: "humano" });
    setDetalhe(null);
  }

  async function marcarPerdido() {
    if (!detalhe || !motivoPerda.trim()) return;
    await supabase.from("hub_leads_crm").update({ motivo_perda: motivoPerda }).eq("id", detalhe.id);
    await moverEstagio(detalhe.id, "perdido");
    await supabase.from("hub_atividades").insert({ lead_id: detalhe.id, tipo: "status_change", descricao: `Lead perdido: ${motivoPerda}`, feito_por: "humano", feito_por_tipo: "humano" });
    setDetalhe(null);
    setMotivoPerda("");
    setConfirmandoPerda(false);
  }

  async function adicionarNota() {
    if (!detalhe || !novaNota.trim()) return;
    const { data } = await supabase.from("hub_notas").insert({ lead_id: detalhe.id, conteudo: novaNota.trim(), criado_por: "humano" }).select().single();
    if (data) setNotas(prev => [data as Nota, ...prev]);
    await supabase.from("hub_atividades").insert({ lead_id: detalhe.id, tipo: "nota", descricao: novaNota.trim().slice(0, 80), feito_por: "humano", feito_por_tipo: "humano" });
    setNovaNota("");
  }

  const filtrados = leads.filter(l => {
    if (
      busca &&
      !l.nome.toLowerCase().includes(busca.toLowerCase()) &&
      !(l.telefone || "").includes(busca) &&
      !(l.codigo || "").toLowerCase().includes(busca.toLowerCase()) &&
      !(l._pessoa_codigo || "").toLowerCase().includes(busca.toLowerCase())
    ) {
      return false;
    }
    if (filtroEstagio && l.estagio !== filtroEstagio) return false;
    return true;
  });

  const hoje = new Date().toDateString();
  const semResposta = leads.filter(l => !["ganho", "perdido"].includes(l.estagio) && Date.now() - new Date(l.atualizado_em).getTime() > 86_400_000).length;
  const emRisco = leads.filter(l => !["ganho", "perdido"].includes(l.estagio) && Date.now() - new Date(l.atualizado_em).getTime() > 3_600_000).reduce((s, l) => s + l.valor_estimado, 0);
  const pipeline = leads.filter(l => !["ganho", "perdido"].includes(l.estagio)).reduce((s, l) => s + l.valor_estimado, 0);

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${leads.length} leads · tempo real`,
      actions: (
        <>
          <div className="inline-flex w-full rounded-lg bg-[#21262d] p-0.5 min-[480px]:w-auto">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "kanban" ? "bg-[#30363d] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "lista" ? "bg-[#30363d] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
            >
              Lista
            </button>
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar lead..."
            className="w-full min-h-11 min-w-0 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-44"
          />
          <select
            value={filtroEstagio}
            onChange={e => setFiltroEstagio(e.target.value)}
            className="w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
          >
            <option value="">Todos os estágios</option>
            {ESTAGIOS.map(e => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, leads.length, view, busca, filtroEstagio, isMobile]);

  const headerControls = (
    <>
      <div className="inline-flex w-full rounded-lg bg-[#21262d] p-0.5 min-[480px]:w-auto">
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "kanban" ? "bg-[#30363d] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setView("lista")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "lista" ? "bg-[#30363d] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
        >
          Lista
        </button>
      </div>
      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar lead..."
        className="w-full min-h-11 min-w-0 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-44"
      />
      <select
        value={filtroEstagio}
        onChange={e => setFiltroEstagio(e.target.value)}
        className="w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
      >
        <option value="">Todos os estágios</option>
        {ESTAGIOS.map(e => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0d1117]">

      {isMobile && (
        <div className="sticky top-0 z-20 shrink-0 space-y-2 border-b border-[#30363d] bg-[#161b22] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-bold text-[#e6edf3]">Leads</h1>
              <p className="text-[11px] text-[#8b949e]">{leads.length} leads · tempo real</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">{headerControls}</div>
        </div>
      )}

      {/* ─── METRICS ─── */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 flex-shrink-0 bg-[#30363d]">
        {[
          { label: "Leads Hoje", value: String(leads.filter(l => new Date(l.criado_em).toDateString() === hoje).length), cor: "#F97316" },
          { label: "Sem Resposta +24h", value: String(semResposta), cor: semResposta > 0 ? "#EF4444" : "#22C55E" },
          { label: "Em Risco +1h", value: emRisco > 0 ? moeda(emRisco) : "—", cor: emRisco > 0 ? "#EAB308" : "#6B7280" },
          { label: "Pipeline Total", value: moeda(pipeline), cor: "#22C55E" },
        ].map(m => (
          <div key={m.label} className="bg-[#161b22] px-3 py-2.5 sm:px-5">
            <p className="mb-0.5 text-xs text-[#8b949e]">{m.label}</p>
            <p className="text-base font-black sm:text-lg" style={{ color: m.cor }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ─── MAIN ─── */}
      <div className="flex-1 overflow-hidden">
        {view === "kanban" ? (

          /* KANBAN */
          <div
            className={`flex h-full overflow-x-auto ${isMobile ? "snap-x snap-mandatory scroll-pl-3 gap-2.5 px-3 py-3 scrollbar-none" : "gap-3 p-4"}`}
          >
            {ESTAGIOS.map(est => {
              const col = filtrados.filter(l => l.estagio === est.id);
              const total = col.reduce((s, l) => s + l.valor_estimado, 0);
              return (
                <div
                  key={est.id}
                  className={`flex flex-shrink-0 flex-col ${isMobile ? "w-[clamp(9rem,50vw,11.5rem)] snap-start" : "w-[230px]"}`}
                >
                  {/* Column header */}
                  <div className="rounded-t-xl px-3 py-2.5" style={{ backgroundColor: est.color + "1A", borderLeft: `3px solid ${est.color}`, borderTop: `1px solid ${est.color}40`, borderRight: `1px solid ${est.color}40` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs">{est.label}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: est.color + "40" }}>{col.length}</span>
                    </div>
                    {total > 0 && <p className="text-xs mt-0.5 font-bold" style={{ color: est.color }}>{moeda(total)}</p>}
                  </div>
                  {/* Cards */}
                  <div className="flex-1 space-y-2 overflow-y-auto rounded-b-xl border border-t-0 border-[#30363d] bg-[#161b22]/60 p-2 transition-colors"
                    style={{ minHeight: 80, backgroundColor: dragOver === est.id ? est.color + "12" : undefined }}
                    onDragOver={e => { e.preventDefault(); setDragOver(est.id); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={e => { e.preventDefault(); const lid = e.dataTransfer.getData("leadId"); if (lid) moverEstagio(lid, est.id); setLeadDragId(null); setDragOver(null); }}>
                    {col.map(lead => (
                      <div key={lead.id}
                        draggable={!isMobile}
                        onDragStart={e => { e.dataTransfer.setData("leadId", lead.id); setLeadDragId(lead.id); }}
                        onDragEnd={() => { setLeadDragId(null); setDragOver(null); }}
                        onClick={() => (isMobile ? abrirDetalhe(lead) : router.push(`/crm/leads/${lead.id}`))}
                        className="cursor-pointer rounded-xl border border-[#30363d] bg-[#161b22] p-3 transition-all hover:bg-[#21262d] active:cursor-grabbing"
                        style={{ borderLeftWidth: 3, borderLeftColor: borderColor(lead.atualizado_em), opacity: leadDragId === lead.id ? 0.5 : 1 }}>
                        <p className="text-white text-xs font-bold truncate leading-tight">{lead.nome}</p>
                        {(lead.codigo || lead._pessoa_codigo) && (
                          <p className="text-[10px] font-mono text-[#c9a24a]/90 truncate mt-0.5">
                            {lead.codigo || lead._pessoa_codigo}
                            {lead.codigo && lead._pessoa_codigo && lead.codigo !== lead._pessoa_codigo && (
                              <span className="text-white/35"> · {lead._pessoa_codigo}</span>
                            )}
                          </p>
                        )}
                        {lead.valor_estimado > 0 && <p className="text-xs font-bold mt-1" style={{ color: "#22C55E" }}>{moeda(lead.valor_estimado)}</p>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {lead.origem && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: (ORIGENS_COLOR[lead.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[lead.origem] || "#9CA3AF" }}>
                              {ORIGENS_LABEL[lead.origem] || lead.origem}
                            </span>
                          )}
                          {lead.agente_responsavel && (
                            <span className="truncate text-xs text-[#8b949e]">{lead.agente_responsavel}</span>
                          )}
                          <span className="ml-auto text-xs text-[#8b949e]">{tempo(lead.atualizado_em)}</span>
                        </div>
                        {isMobile && lead.telefone && (
                          <a
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg bg-[#25D366] text-xs font-bold text-white"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    ))}
                    {col.length === 0 && <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>}
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* LISTA */
          <div className="h-full overflow-y-auto">
            {isMobile ? (
              <ul className="space-y-2 p-3 pb-24">
                {filtrados.map(lead => {
                  const est = ESTAGIOS.find(e => e.id === lead.estagio);
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => abrirDetalhe(lead)}
                        className="flex w-full min-h-14 flex-col gap-2 rounded-xl border border-[#30363d] bg-[#161b22] p-3 text-left"
                        style={{ borderLeftWidth: 3, borderLeftColor: borderColor(lead.atualizado_em) }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#e6edf3]">{lead.nome}</p>
                            {lead.telefone && <p className="text-xs text-[#8b949e]">{lead.telefone}</p>}
                          </div>
                          {est && (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: est.color + "25", color: est.color }}>
                              {est.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {lead.valor_estimado > 0 && <span className="text-xs font-bold text-[#22C55E]">{moeda(lead.valor_estimado)}</span>}
                          <span className="ml-auto text-xs text-[#8b949e]">{tempo(lead.atualizado_em)}</span>
                        </div>
                        {lead.telefone && (
                          <a
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#25D366] text-xs font-bold text-white"
                          >
                            WhatsApp
                          </a>
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtrados.length === 0 && (
                  <p className="py-12 text-center text-sm text-[#8b949e]">Nenhum lead encontrado</p>
                )}
              </ul>
            ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                <tr>
                  {["Nome", "Origem", "Estágio", "Valor", "Score", "Agente", "Atualizado", ""].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-bold uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(lead => {
                  const est = ESTAGIOS.find(e => e.id === lead.estagio);
                  return (
                    <tr key={lead.id} onClick={() => router.push(`/crm/leads/${lead.id}`)}
                      className="border-b border-gray-800/50 hover:bg-gray-900/60 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-bold">{lead.nome}</p>
                        {(lead.codigo || lead._pessoa_codigo) && (
                          <p className="text-[#c9a24a] font-mono text-xs mt-0.5">
                            {lead.codigo || lead._pessoa_codigo}
                            {lead.codigo && lead._pessoa_codigo && lead.codigo !== lead._pessoa_codigo && (
                              <span className="text-white/40"> · {lead._pessoa_codigo}</span>
                            )}
                          </p>
                        )}
                        {lead.telefone && <p className="text-gray-500 text-xs">{lead.telefone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.origem ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: (ORIGENS_COLOR[lead.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[lead.origem] || "#9CA3AF" }}>
                            {ORIGENS_LABEL[lead.origem] || lead.origem}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {est && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ backgroundColor: est.color + "20", color: est.color }}>{est.label}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.valor_estimado > 0 ? <span className="text-green-400 font-bold">{moeda(lead.valor_estimado)}</span> : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${lead.score}%` }} />
                          </div>
                          <span className="text-gray-500 text-xs">{lead.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{lead.agente_responsavel || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{tempo(lead.atualizado_em)}</td>
                      <td className="px-4 py-3"><button className="text-[#c9a24a] hover:text-[#e0b86a] text-xs">Ver →</button></td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600 text-sm">Nenhum lead encontrado</td></tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>

      {/* ─── LEAD DETAIL SLIDE-OVER ─── */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex">
          {!isMobile && (
            <div className="flex-1 bg-black/50" onClick={() => { setDetalhe(null); setConfirmandoPerda(false); }} />
          )}
          <div className={`flex h-full flex-col overflow-hidden border-[#30363d] bg-[#161b22] shadow-2xl ${isMobile ? "w-full" : "w-[520px] border-l"}`}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-black text-lg truncate">{detalhe.nome}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {detalhe.telefone && <span className="text-gray-500 text-xs">{detalhe.telefone}</span>}
                    {detalhe.email && <span className="text-gray-500 text-xs">{detalhe.email}</span>}
                    {detalhe.origem && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (ORIGENS_COLOR[detalhe.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[detalhe.origem] || "#9CA3AF" }}>
                        {ORIGENS_LABEL[detalhe.origem] || detalhe.origem}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setDetalhe(null); setConfirmandoPerda(false); }} className="text-gray-500 hover:text-white text-2xl">×</button>
              </div>

              {/* Stage selector */}
              <div className="flex gap-1 flex-wrap">
                {ESTAGIOS.map(e => (
                  <button key={e.id} onClick={() => moverEstagio(detalhe.id, e.id)}
                    className="text-xs px-2.5 py-1 rounded-full font-bold transition-all"
                    style={{
                      backgroundColor: detalhe.estagio === e.id ? e.color : e.color + "18",
                      color: detalhe.estagio === e.id ? "#fff" : e.color,
                      border: `1px solid ${detalhe.estagio === e.id ? e.color : e.color + "40"}`,
                    }}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 px-5 py-3 border-b border-gray-800 flex-shrink-0 overflow-x-auto">
              {[
                { label: "📞 Ligar", action: () => {} },
                { label: "📅 Agendar", action: () => setTabDetalhe("notas") },
                { label: "📝 Nota", action: () => setTabDetalhe("notas") },
                { label: "🏆 Ganho", action: marcarGanho },
                { label: "❌ Perdido", action: () => setConfirmandoPerda(true) },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 flex-shrink-0 transition-colors">
                  {a.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 flex-shrink-0">
              {(["info", "timeline", "notas", "memorias"] as const).map(t => (
                <button key={t} onClick={() => setTabDetalhe(t)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tabDetalhe === t ? "text-[#c9a24a] border-b-2 border-[#c9a24a]" : "text-gray-500 hover:text-white"}`}>
                  {t === "info" ? "Info" : t === "timeline" ? "Timeline" : t === "notas" ? `Notas (${notas.length})` : "Memórias IA"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {tabDetalhe === "info" && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Valor", value: detalhe.valor_estimado > 0 ? moeda(detalhe.valor_estimado) : "—" },
                      { label: "Score", value: `${detalhe.score}/100` },
                      { label: "Campanha", value: detalhe.campanha || "—" },
                      { label: "Agente", value: detalhe.agente_responsavel || "—" },
                      { label: "Responsável", value: detalhe.humano_responsavel || "—" },
                      { label: "Criado", value: new Date(detalhe.criado_em).toLocaleDateString("pt-BR") },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-1">{item.label}</p>
                        <p className="text-white text-sm font-bold truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {detalhe.proxima_acao && (
                    <div className="bg-[#1a1200] border border-[#4a3500] rounded-xl p-3">
                      <p className="text-[#c9a24a] text-xs font-bold uppercase mb-1">Próxima Ação</p>
                      <p className="text-white text-sm">{detalhe.proxima_acao}</p>
                    </div>
                  )}
                  {detalhe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detalhe.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full border border-gray-700">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tabDetalhe === "timeline" && (
                <div className="p-5">
                  {atividades.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-8">Nenhuma atividade registrada</p>
                    : (
                      <div>
                        {atividades.map((a, i) => (
                          <div key={a.id} className="flex gap-3 pb-4">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm">
                                {ATIVIDADE_ICON[a.tipo] || "•"}
                              </div>
                              {i < atividades.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" />}
                            </div>
                            <div className="pt-1 flex-1 min-w-0">
                              <p className="text-white text-sm leading-snug">{a.descricao}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-gray-600 text-xs">{a.feito_por}</span>
                                <span className="text-gray-700">·</span>
                                <span className="text-gray-600 text-xs">{tempo(a.criado_em)} atrás</span>
                                {a.feito_por_tipo === "ia" && <span className="text-[#c9a24a] text-xs font-bold">IA</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {tabDetalhe === "notas" && (
                <div className="p-5 space-y-3">
                  <div>
                    <textarea value={novaNota} onChange={e => setNovaNota(e.target.value)}
                      placeholder="Escreva uma nota..."
                      rows={3}
                      className="w-full bg-gray-800 text-white text-sm rounded-xl p-3 border border-gray-700 focus:border-[#c9a24a] outline-none resize-none placeholder:text-gray-600" />
                    <button onClick={adicionarNota} disabled={!novaNota.trim()}
                      className="w-full mt-2 bg-[#c9a24a] hover:bg-[#e0b86a] disabled:opacity-40 text-white text-sm py-2 rounded-xl font-bold transition-colors">
                      + Adicionar Nota
                    </button>
                  </div>
                  {notas.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-4">Nenhuma nota ainda</p>
                    : notas.map(n => (
                      <div key={n.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                        <p className="text-white text-sm leading-relaxed">{n.conteudo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-gray-600 text-xs">{n.criado_por}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-gray-600 text-xs">{tempo(n.criado_em)} atrás</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {tabDetalhe === "memorias" && (
                <div className="p-5">
                  {memorias.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-8">A IA ainda não registrou memórias sobre este lead</p>
                    : (
                      <div className="space-y-2">
                        {memorias.map(m => (
                          <div key={m.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[#c9a24a] text-xs font-bold uppercase">{m.chave}</span>
                              <span className="text-gray-600 text-xs">{Math.round(m.confianca * 100)}% confiança</span>
                            </div>
                            <p className="text-white text-sm">{m.valor}</p>
                            <p className="text-gray-600 text-xs mt-1">{tempo(m.criado_em)} atrás</p>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Marcar perdido */}
            {confirmandoPerda && (
              <div className="flex-shrink-0 p-4 border-t border-red-900 bg-[#1a0000]">
                <p className="text-red-400 text-xs font-bold mb-2">Motivo da perda (obrigatório):</p>
                <input value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)}
                  placeholder="Ex: Preço alto, foi para concorrente..."
                  className="w-full bg-red-900 text-white text-sm rounded-lg px-3 py-2 border border-red-700 outline-none placeholder:text-red-400 mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => setConfirmandoPerda(false)} className="flex-1 bg-gray-800 text-gray-400 text-sm py-2 rounded-lg font-bold hover:text-white transition-colors">Cancelar</button>
                  <button onClick={marcarPerdido} disabled={!motivoPerda.trim()} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-bold transition-colors">Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
