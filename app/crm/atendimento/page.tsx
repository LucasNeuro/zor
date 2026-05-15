"use client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import {
  Bot,
  Brain,
  Contact,
  FileText,
  Info,
  MessageSquare,
  Phone,
  Send,
  UserCheck,
  X,
} from "lucide-react";

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  valor_estimado?: number;
  estagio: string;
  origem: string;
  criado_em: string;
  agente_responsavel?: string;
  humano_responsavel?: string;
  score?: number;
  ultimo_contato?: string;
  campanha?: string;
  proxima_acao?: string;
  data_proxima_acao?: string;
  interesse_principal?: string;
  tags?: string[];
  observacoes?: unknown;
  metadata?: Record<string, unknown>;
}

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: "entrada" | "saida";
  criado_em: string;
  agente_id?: string;
  metadata?: Record<string, unknown>;
}

const STATUS_COR: Record<string, string> = {
  novo: "bg-yellow-500", qualificando: "bg-cyan-500", qualificado: "bg-green-500",
  atendimento: "bg-blue-500", negociando: "bg-purple-500", fechamento: "bg-orange-500",
  ganho: "bg-emerald-500", perdido: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", qualificando: "Qualificando", qualificado: "Qualificado",
  atendimento: "Em Atendimento", negociando: "Negociando",
  fechamento: "Fechamento", ganho: "Ganho", perdido: "Perdido",
};

/** MANIFEST: verde #003b26, dourado #c9a24a, fundo #0d1117 */
const C = {
  bg: "bg-[#0d1117]",
  bgAlt: "bg-[#0a0e14]",
  border: "border-white/[0.08]",
  gold: "text-[#c9a24a]",
  green: "bg-[#003b26]",
} as const;

function AtendimentoContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSlot } = useCrmHeaderSlot();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSel, setLeadSel] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [assumido, setAssumido] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagensLoadError, setMensagensLoadError] = useState<string | null>(null);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [sendStrip, setSendStrip] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const leadsCarregados = useRef(false);

  // Auto-scroll ao fundo quando chegam mensagens
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  // Deep link: ?lead=<id>
  useEffect(() => {
    if (!leadsCarregados.current || leads.length === 0) return;
    const leadId = searchParams.get("lead");
    if (leadId) {
      const found = leads.find(l => l.id === leadId);
      if (found) selecionarLead(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, leads]);

  useEffect(() => {
    setCarregando(true);
    carregarLeads();
    const t = setInterval(carregarLeads, 30000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function carregarLeads() {
    const qs = filtro !== "todos" ? `?estagio=${filtro}` : "";
    const res = await fetch(`/api/crm/atendimento${qs}`, { headers: internalApiHeaders() });
    const json = await res.json();
    setLeads((json.leads ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      nome: (d.nome as string) || "Lead",
      telefone: d.telefone as string,
      email: d.email as string,
      estagio: (d.estagio as string) || "novo",
      origem: (d.origem as string) || "whatsapp",
      valor_estimado: d.valor_estimado as number,
      criado_em: d.criado_em as string,
      agente_responsavel: d.agente_responsavel as string,
      humano_responsavel: d.humano_responsavel as string,
      score: d.score as number,
      ultimo_contato: d.ultimo_contato as string,
      campanha: d.campanha as string,
      proxima_acao: d.proxima_acao as string,
      data_proxima_acao: d.data_proxima_acao as string,
      interesse_principal: d.interesse_principal as string,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      observacoes: d.observacoes,
      metadata: (d.metadata && typeof d.metadata === "object" ? d.metadata : undefined) as Record<string, unknown> | undefined,
    })));
    leadsCarregados.current = true;
    setCarregando(false);
  }

  const carregarMensagens = useCallback(async (leadId: string, opts?: { quiet?: boolean }) => {
    const quiet = opts?.quiet === true;
    if (!quiet) {
      setMensagensLoadError(null);
      setCarregandoMensagens(true);
    }
    try {
      const res = await fetch(
        `/api/crm/atendimento/mensagens?leadId=${encodeURIComponent(leadId)}`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const json: { mensagens?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMensagens([]);
        if (!quiet) {
          setMensagensLoadError(
            typeof json.error === "string"
              ? json.error
              : "Não foi possível carregar as mensagens. Tente novamente."
          );
        }
        return;
      }
      const raw = (json.mensagens ?? []) as Record<string, unknown>[];
      setMensagens(
        raw.map((m) => ({
          id: String(m.id ?? ""),
          conteudo: String(m.conteudo ?? ""),
          direcao: (m.direcao === "entrada" || m.direcao === "saida" ? m.direcao : "entrada") as "entrada" | "saida",
          criado_em: String(m.criado_em ?? ""),
          agente_id: m.agente_id as string | undefined,
          metadata: (m.metadata && typeof m.metadata === "object" ? m.metadata : undefined) as Record<string, unknown> | undefined,
        }))
      );
      if (!quiet) setMensagensLoadError(null);
    } catch {
      setMensagens([]);
      if (!quiet) setMensagensLoadError("Erro de rede ao carregar mensagens.");
    } finally {
      if (!quiet) setCarregandoMensagens(false);
    }
  }, []);

  function selecionarLead(lead: Lead) {
    setLeadSel(lead);
    setAssumido(!!lead.humano_responsavel);
    setTexto("");
    setSendStrip(null);
    setMensagensLoadError(null);
    setInfoOpen(false);
  }

  // Ocultar faixa de sucesso / info após envio
  useEffect(() => {
    if (!sendStrip || sendStrip.kind === "error") return;
    const ms = sendStrip.kind === "info" ? 8000 : 4500;
    const t = window.setTimeout(() => setSendStrip(null), ms);
    return () => window.clearTimeout(t);
  }, [sendStrip]);

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  // Sincroniza ficha do lead quando a lista atualiza (polling 30s)
  useEffect(() => {
    if (!leadSel) return;
    const fresh = leads.find((l) => l.id === leadSel.id);
    if (fresh) {
      setLeadSel(fresh);
      setAssumido(!!fresh.humano_responsavel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- apenas id estável + lista nova
  }, [leads, leadSel?.id]);

  // Realtime por lead selecionado — INSERT refetch via API (quiet = sem piscar loading)
  useEffect(() => {
    if (!leadSel) {
      setMensagens([]);
      setMensagensLoadError(null);
      setCarregandoMensagens(false);
      return;
    }
    setMensagens([]);
    void carregarMensagens(leadSel.id);
    const channel = supabase
      .channel(`atend-${leadSel.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "hub_fila_mensagens",
        filter: `lead_id=eq.${leadSel.id}`,
      }, () => { void carregarMensagens(leadSel.id, { quiet: true }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadSel?.id, carregarMensagens]);

  async function assumirAtendimento() {
    if (!leadSel) return;
    await supabase.from("hub_leads_crm").update({ humano_responsavel: "wendel" }).eq("id", leadSel.id);
    await supabase.from("hub_atividades").insert({
      lead_id: leadSel.id, tipo: "ia_acao",
      descricao: "Atendimento assumido por Wendel",
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    setAssumido(true);
    setLeadSel(prev => prev ? { ...prev, humano_responsavel: "wendel" } : prev);
  }

  async function devolverIA() {
    if (!leadSel) return;
    await supabase.from("hub_leads_crm").update({ humano_responsavel: null }).eq("id", leadSel.id);
    await supabase.from("hub_atividades").insert({
      lead_id: leadSel.id, tipo: "ia_acao",
      descricao: "Atendimento devolvido para a IA",
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    setAssumido(false);
    setLeadSel(prev => prev ? { ...prev, humano_responsavel: undefined } : prev);
  }

  async function enviarMensagem() {
    if (!leadSel || !texto.trim() || enviando) return;
    setEnviando(true);
    setSendStrip(null);
    const msg = texto.trim();
    setTexto("");
    try {
      const res = await fetch("/api/crm/atendimento/send", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...internalApiHeaders(),
        },
        body: JSON.stringify({ leadId: leadSel.id, texto: msg }),
      });
      const json: { error?: string; whatsappSkipped?: boolean } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        const fromBody = typeof json.error === "string" ? json.error : null;
        const errText =
          res.status === 502 || res.status === 403
            ? (fromBody ?? "Operação não permitida ou serviço indisponível.")
            : (fromBody ?? "Não foi possível enviar a mensagem.");
        setTexto(msg);
        setSendStrip({ kind: "error", text: errText });
        return;
      }
      if (json.whatsappSkipped) {
        setSendStrip({
          kind: "info",
          text: "Mensagem registada no CRM e no histórico do chat. Nada foi enviado ao WhatsApp (dry-run ou provedor não configurado). Configure UAZAPI_BASE_URL + UAZAPI_INSTANCE_TOKEN no .env.",
        });
      } else {
        setSendStrip({ kind: "success", text: "Mensagem enviada." });
      }
      await carregarMensagens(leadSel.id);
    } catch {
      setTexto(msg);
      setSendStrip({ kind: "error", text: "Erro de rede ao enviar." });
    } finally {
      setEnviando(false);
    }
  }

  const rel = (d: string) => {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };

  const formatarDataHora = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const textoObservacoes = (v: unknown): string => {
    if (v == null) return "—";
    if (typeof v === "string") return v.trim() || "—";
    if (Array.isArray(v)) {
      const flat = v.map((x) => String(x ?? "").trim()).filter(Boolean);
      return flat.length ? flat.join(" · ") : "—";
    }
    if (typeof v === "object") {
      const s = JSON.stringify(v);
      return s && s !== "{}" && s !== "[]" ? s : "—";
    }
    const s = String(v).trim();
    return s || "—";
  };

  const filtrosAtendimento = ["todos", "novo", "qualificando", "qualificado", "atendimento", "negociando"] as const;

  const contagemPorFiltro = useMemo(() => {
    const map: Record<string, number> = { todos: leads.length };
    for (const f of filtrosAtendimento) {
      if (f === "todos") continue;
      map[f] = leads.filter((l) => l.estagio === f).length;
    }
    return map;
  }, [leads]);

  const filtrados = leads.filter(l =>
    !busca || l.nome.toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${leads.length} conversas ativas`,
      actions: (
        <div className={`flex items-center gap-2 rounded-full border ${C.border} bg-[#0a0e14] px-3 py-1.5`}>
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#22c55e]" />
          <span className={`text-xs font-semibold ${C.gold}`}>Ariane online</span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, leads.length]);

  return (
    <div className={`flex flex-1 min-h-0 flex-col overflow-hidden ${C.bg}`}>
      <div className="flex flex-1 overflow-hidden">

        {/* LISTA DE LEADS */}
        <div className={`w-72 flex-shrink-0 flex flex-col border-r ${C.border} ${C.bgAlt}`}>
          <div className={`p-3 border-b ${C.border} space-y-2`}>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar lead…"
              className={`w-full bg-black/25 text-zinc-100 text-xs rounded-lg px-3 py-2.5 outline-none border ${C.border} focus:ring-1 focus:ring-[#c9a24a]/40 placeholder-zinc-600`}
            />
            <div className="flex gap-1 flex-wrap">
              {filtrosAtendimento.map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors border ${
                    filtro === f
                      ? "bg-[#c9a24a]/20 text-[#c9a24a] border-[#c9a24a]/35 font-semibold"
                      : "bg-white/[0.04] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}>
                  {f === "todos" ? "Todos" : STATUS_LABEL[f]}{" "}
                  <span className="opacity-70">({contagemPorFiltro[f] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? (
              <div className="p-4 text-center text-zinc-500 text-xs">A carregar conversas…</div>
            ) : filtrados.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">Nenhum lead neste filtro</div>
            ) : filtrados.map(lead => (
              <button key={lead.id} onClick={() => selecionarLead(lead)}
                className={`w-full px-3 py-3 border-b border-white/[0.05] text-left transition-colors ${
                  leadSel?.id === lead.id
                    ? "bg-[#003b26]/35 border-l-2 border-l-[#c9a24a]"
                    : "hover:bg-white/[0.04]"
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 flex-shrink-0 rounded-full ring-1 ring-white/10 ${STATUS_COR[lead.estagio] || "bg-gray-500"}`} />
                    <span className="text-zinc-100 text-xs font-semibold truncate">{lead.nome}</span>
                  </div>
                  <span className="text-zinc-600 text-[10px] flex-shrink-0 ml-1 tabular-nums">{rel(lead.criado_em)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-[10px] uppercase tracking-wide">
                    {lead.origem}
                    {lead.ultimo_contato ? ` · contato ${rel(lead.ultimo_contato)}` : ""}
                  </span>
                  {lead.humano_responsavel && (
                    <span className="text-[10px] font-medium text-[#22c55e]/90">Humano</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ÁREA DO CHAT */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0a0e14]">
          {!leadSel ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-sm">
                <div
                  className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#003b26]/30 mb-4 text-[#c9a24a]"
                  aria-hidden
                >
                  <MessageSquare size={28} strokeWidth={1.75} />
                </div>
                <p className="text-zinc-300 text-sm font-medium">Selecione um lead para atender</p>
                <p className="text-zinc-600 text-xs mt-2">{leads.length} conversas nesta vista</p>
              </div>
            </div>
          ) : (
            <>
              {/* Cabeçalho do chat */}
              <div className={`px-4 py-3.5 border-b ${C.border} flex items-center justify-between flex-shrink-0 bg-black/20`}>
                <div className="min-w-0">
                  <div className="text-zinc-50 font-semibold text-sm truncate">{leadSel.nome}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COR[leadSel.estagio] || "bg-gray-500"}`} />
                    <span className="text-zinc-500 text-[11px]">{STATUS_LABEL[leadSel.estagio] || leadSel.estagio}</span>
                    {leadSel.telefone && (
                      <span className="text-zinc-600 text-[11px]">· {leadSel.telefone}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`flex items-center rounded-xl border ${C.border} bg-black/30 p-1 gap-0.5 flex-shrink-0 shadow-sm shadow-black/20`}
                >
                  {assumido ? (
                    <span
                      className={`${C.green} flex items-center gap-1.5 text-white text-[11px] px-3 py-1.5 rounded-lg font-semibold ring-1 ring-white/10`}
                      title="Atendimento humano ativo"
                    >
                      <UserCheck size={14} strokeWidth={2} aria-hidden />
                      A atender
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={assumirAtendimento}
                      className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      <UserCheck size={14} strokeWidth={2} className="text-[#c9a24a]" aria-hidden />
                      Assumir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/crm/leads/${leadSel.id}`)}
                    className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <FileText size={14} strokeWidth={2} className="text-[#c9a24a]" aria-hidden />
                    Ver ficha
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[#c9a24a] text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Info size={14} strokeWidth={2} className="text-[#c9a24a]" aria-hidden />
                    Info
                  </button>
                  {assumido && (
                    <button
                      type="button"
                      onClick={() => void devolverIA()}
                      className="flex items-center gap-1.5 bg-sky-950/50 hover:bg-sky-950/70 border border-sky-500/35 text-sky-100 text-[11px] px-3 py-1.5 rounded-lg transition-colors font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      title="Encerrar atendimento humano e voltar a respostas da IA"
                    >
                      <Bot size={14} strokeWidth={2} className="text-sky-300 shrink-0" aria-hidden />
                      Devolver à IA
                    </button>
                  )}
                </div>
              </div>

              {/* Mensagens + Realtime */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagensLoadError && (
                  <div className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[12px] text-red-200/95">
                    {mensagensLoadError}
                  </div>
                )}
                {carregandoMensagens && mensagens.length === 0 && !mensagensLoadError && (
                  <div className="text-center text-zinc-500 text-xs mt-12">A carregar mensagens…</div>
                )}
                {!carregandoMensagens && !mensagensLoadError && mensagens.length === 0 && (
                  <div className="text-center text-zinc-600 text-xs mt-12">Ainda não há mensagens nesta conversa</div>
                )}
                {mensagens.map(msg => {
                  const entrada = msg.direcao === "entrada";
                  const isHumano = !entrada && msg.agente_id === "wendel";
                  return (
                    <div key={msg.id} className={`flex ${entrada ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[min(28rem,85vw)] flex flex-col gap-0.5 ${entrada ? "items-start" : "items-end"}`}>
                        {!entrada && (
                          <span className="text-zinc-600 text-[10px] mr-1">
                            {isHumano ? "Você" : `IA · ${msg.agente_id || "agente"}`}
                          </span>
                        )}
                        <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                          entrada
                            ? "bg-zinc-800/90 text-zinc-100 rounded-bl-md border border-white/[0.06]"
                            : isHumano
                              ? "bg-[#c9a24a]/20 text-[#f4e8c9] rounded-br-md border border-[#c9a24a]/35"
                              : "bg-[#003b26] text-zinc-50 rounded-br-md border border-white/10"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        </div>
                        <span className="text-zinc-600 text-[10px] tabular-nums">{rel(msg.criado_em)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compor + enviar */}
              <div className={`flex-shrink-0 p-3 border-t ${C.border} bg-black/25`}>
                {sendStrip && (
                  <div className={`mb-2 rounded-md px-3 py-2 text-[11px] border ${
                    sendStrip.kind === "error"
                      ? "border-red-500/40 bg-red-950/50 text-red-200"
                      : sendStrip.kind === "info"
                        ? "border-amber-500/40 bg-amber-950/40 text-amber-100/95"
                        : "border-[#003b26]/50 bg-[#003b26]/25 text-zinc-200"
                  }`}>
                    {sendStrip.text}
                  </div>
                )}
                <div className="flex gap-2 items-stretch">
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    disabled={!assumido}
                    placeholder={assumido ? "Escreva a resposta… (Enter envia · Shift+Enter nova linha)" : "Assuma o atendimento para escrever"}
                    rows={2}
                    className={`flex-1 bg-black/30 disabled:opacity-45 text-zinc-100 text-xs rounded-xl px-3 py-2.5 outline-none resize-none border ${C.border} focus:ring-1 focus:ring-[#c9a24a]/35 placeholder-zinc-600`}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensagem(); }
                    }}
                  />
                  <div
                    className={`rounded-xl border ${C.border} bg-black/25 p-1 min-w-[7.5rem] sm:min-w-[8.5rem]`}
                  >
                    <button
                      type="button"
                      onClick={() => void enviarMensagem()}
                      disabled={!assumido || !texto.trim() || enviando}
                      className={`inline-flex w-full min-h-[2.75rem] items-center justify-center gap-1.5 ${C.green} hover:brightness-110 disabled:opacity-40 text-white px-3 py-2.5 rounded-lg font-semibold text-[12px] transition-all`}
                    >
                      {enviando ? (
                        <span className="tabular-nums">…</span>
                      ) : (
                        <>
                          <Send size={15} strokeWidth={2} aria-hidden />
                          Enviar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {/* SIDOVER: Informações + Ações (libera área do atendimento) */}
      {leadSel && infoOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel de informações"
            onClick={() => setInfoOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)", border: "none", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              zIndex: 60,
              background: "#0a0e14",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                padding: 16,
                background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#c9a24a", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                    ATENDIMENTO
                  </p>
                  <h3 style={{ margin: "3px 0 0", color: "#e6edf3", fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Informações do lead
                  </h3>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(false)}
                    style={{
                      border: "1px solid #344256",
                      background: "#1d2633",
                      color: "#9eb0c8",
                      borderRadius: 8,
                      width: 34,
                      height: 34,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="Fechar"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2 [&_svg]:shrink-0`}>
                  <Contact size={14} strokeWidth={2} className="opacity-95" aria-hidden />
                  <span>Dados do lead</span>
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Nome", value: leadSel.nome || "—" },
                    { label: "Estágio", value: STATUS_LABEL[leadSel.estagio] || leadSel.estagio },
                    { label: "Interesse", value: leadSel.interesse_principal || "—" },
                    { label: "Campanha", value: leadSel.campanha || "—" },
                    { label: "Agente IA", value: leadSel.agente_responsavel || "sdr" },
                    { label: "Humano", value: leadSel.humano_responsavel || "—" },
                    { label: "Score", value: `${leadSel.score ?? 0}/100` },
                    { label: "Valor", value: (leadSel.valor_estimado ?? 0) > 0 ? `R$ ${((leadSel.valor_estimado ?? 0) / 1000).toFixed(0)}k` : "—" },
                    { label: "Abertura", value: formatarDataHora(leadSel.criado_em) },
                    { label: "Próxima ação", value: leadSel.proxima_acao || "—" },
                    { label: "Data próx. ação", value: formatarDataHora(leadSel.data_proxima_acao) },
                    { label: "Tags", value: leadSel.tags && leadSel.tags.length ? leadSel.tags.join(", ") : "—" },
                    { label: "Observações", value: textoObservacoes(leadSel.observacoes) },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2 [&_svg]:shrink-0`}>
                  <Brain size={14} strokeWidth={2} className="opacity-95" aria-hidden />
                  <span>Qualificação IA</span>
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Score", value: `${leadSel.score ?? 0}/100` },
                    { label: "Interesse principal", value: leadSel.interesse_principal || "—" },
                    {
                      label: "Mercado (metadata)",
                      value:
                        (leadSel.metadata && typeof leadSel.metadata.mercado === "string" && leadSel.metadata.mercado) ||
                        "—",
                    },
                    {
                      label: "Primeira mensagem (metadata)",
                      value:
                        (leadSel.metadata &&
                          typeof leadSel.metadata.primeira_mensagem === "string" &&
                          leadSel.metadata.primeira_mensagem) ||
                        "—",
                    },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2 [&_svg]:shrink-0`}>
                  <MessageSquare size={14} strokeWidth={2} className="opacity-95" aria-hidden />
                  <span>Dados de WhatsApp</span>
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Canal", value: "WhatsApp" },
                    { label: "Origem", value: leadSel.origem || "—" },
                    { label: "Últ. contato", value: leadSel.ultimo_contato ? rel(leadSel.ultimo_contato) : "—" },
                    { label: "Últ. contato (data/hora)", value: formatarDataHora(leadSel.ultimo_contato) },
                    {
                      label: "Responsável atual",
                      value: leadSel.humano_responsavel ? `Humano (${leadSel.humano_responsavel})` : "IA",
                    },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 18 }} className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2 [&_svg]:shrink-0`}>
                  <Phone size={14} strokeWidth={2} className="opacity-95" aria-hidden />
                  <span>Contato</span>
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Telefone", value: leadSel.telefone || "—" },
                    { label: "E-mail", value: leadSel.email || "—" },
                  ].map((i) => (
                    <div key={i.label} className={`rounded-lg border ${C.border} bg-black/25 px-3 py-2`}>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">{i.label}</p>
                      <p className="text-zinc-100 text-[12px] font-medium mt-0.5 leading-snug break-words">{i.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl border ${C.border} bg-black/25 p-3`}>
                <p className={`${C.gold} text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2 [&_svg]:shrink-0`}>
                  <Info size={14} strokeWidth={2} className="opacity-95" aria-hidden />
                  <span>Ações</span>
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={assumirAtendimento}
                    disabled={assumido}
                    className={`w-full border ${C.border} bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-zinc-100 text-[12px] py-2.5 rounded-lg text-left px-3 transition-colors font-medium inline-flex items-center gap-2`}
                  >
                    <UserCheck size={15} strokeWidth={2} className="text-[#c9a24a]/90 shrink-0" aria-hidden />
                    Assumir atendimento
                  </button>
                  <button
                    type="button"
                    onClick={devolverIA}
                    disabled={!assumido}
                    className={`w-full border ${C.border} bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-zinc-100 text-[12px] py-2.5 rounded-lg text-left px-3 transition-colors font-medium inline-flex items-center gap-2`}
                  >
                    <Bot size={15} strokeWidth={2} className="text-[#c9a24a]/90 shrink-0" aria-hidden />
                    Devolver à IA
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense>
      <AtendimentoContent />
    </Suspense>
  );
}
