"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  origem: string;
  estagio: string;
  valor_estimado: number;
  agente_responsavel?: string;
  humano_responsavel?: string;
  criado_em: string;
  atualizado_em: string;
  metadata?: Record<string, unknown>;
}

interface Mensagem {
  id: string;
  lead_id: string;
  conteudo: string;
  direcao: string;
  criado_em: string;
  agente_id?: string;
  metadata?: Record<string, unknown>;
}

interface Aprovacao {
  id: string;
  tipo: string;
  agente_slug: string;
  descricao: string;
  motivo: string;
  valor_envolvido?: number;
  status: string;
  criado_em: string;
}

interface Alerta {
  id: string;
  tipo: string;
  agente_slug: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, unknown>;
  lead_id?: string;
  criado_em: string;
}

function ConversaInline({ lead, onFechar }: { lead: Lead; onFechar: () => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [assumido, setAssumido] = useState(!!lead.humano_responsavel);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarMsgs();
    const sub = supabase.channel(`conversa-${lead.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_fila_mensagens", filter: `lead_id=eq.${lead.id}` }, carregarMsgs)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  async function carregarMsgs() {
    const { data } = await supabase.from("hub_fila_mensagens").select("*")
      .eq("lead_id", lead.id).order("criado_em", { ascending: true }).limit(50);
    if (data) setMensagens(data as Mensagem[]);
  }

  async function assumir() {
    await supabase.from("hub_leads_crm").update({ humano_responsavel: "wendel", atualizado_em: new Date().toISOString() }).eq("id", lead.id);
    await supabase.from("hub_atividades").insert({ lead_id: lead.id, tipo: "ia_acao", descricao: "Atendimento assumido por Wendel", feito_por: "wendel", feito_por_tipo: "humano" });
    setAssumido(true);
  }

  async function enviar() {
    if (!texto.trim() || !assumido) return;
    setEnviando(true);
    await supabase.from("hub_fila_mensagens").insert({
      lead_id: lead.id, agente_id: "wendel", canal: "whatsapp",
      direcao: "saida", conteudo: texto, status: "enviado",
      metadata: { feito_por: "humano" },
    });
    await supabase.from("hub_atividades").insert({ lead_id: lead.id, tipo: "mensagem", descricao: texto.slice(0, 80), feito_por: "wendel", feito_por_tipo: "humano" });
    setTexto("");
    setEnviando(false);
  }

  function tempo(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "agora";
    if (s < 3600) return `${Math.round(s / 60)}min`;
    return `${Math.round(s / 3600)}h`;
  }

  return (
    <div className="flex flex-col" style={{ height: "400px", background: "#0d1117" }}>
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid #30363d", background: "#161b22" }}>
        <div>
          <p className="text-white font-bold text-sm">{lead.nome}</p>
          <p className="text-xs" style={{ color: "#8b949e" }}>{lead.estagio} · {lead.origem}</p>
        </div>
        <div className="flex items-center gap-2">
          {!assumido
            ? <button onClick={assumir} className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#003b26" }}>Assumir</button>
            : <span className="text-xs font-bold" style={{ color: "#c9a24a" }}>✓ Você</span>
          }
          <button onClick={onFechar} style={{ color: "#8b949e", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mensagens.length === 0
          ? <p className="text-center text-xs py-8" style={{ color: "#484f58" }}>Nenhuma mensagem ainda</p>
          : mensagens.map(msg => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.direcao === "saida" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%", padding: "8px 12px", fontSize: 12,
                background: msg.direcao === "saida" ? "#003b26" : "#21262d", color: "#e6edf3",
                borderRadius: msg.direcao === "saida" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              }}>
                <p style={{ margin: 0 }}>{msg.conteudo}</p>
                <p style={{ margin: "4px 0 0", color: "#484f58", fontSize: 10, textAlign: "right" }}>{tempo(msg.criado_em)}</p>
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 p-2" style={{ borderTop: "1px solid #30363d", background: "#161b22" }}>
        {!assumido
          ? <button onClick={assumir} className="w-full py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#c9a24a", border: "none", cursor: "pointer" }}>Assumir atendimento para responder</button>
          : <div className="flex gap-2">
              <input value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }}}
                placeholder="Digite sua mensagem..." className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                style={{ background: "#21262d", color: "#e6edf3", border: "1px solid #30363d" }} />
              <button onClick={enviar} disabled={!texto.trim() || enviando}
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white"
                style={{ background: "#003b26", border: "none", cursor: "pointer", flexShrink: 0, opacity: !texto.trim() || enviando ? 0.5 : 1 }}>→</button>
            </div>
        }
      </div>
    </div>
  );
}

export default function DecisionPanel() {
  const router = useRouter();
  const [aba, setAba] = useState<"leads" | "aprovacoes" | "alertas">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [conversaAberta, setConversaAberta] = useState<Lead | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    const [l, a, al] = await Promise.all([
      supabase.from("hub_leads_crm").select("*")
        .not("estagio", "in", '("ganho","perdido")')
        .order("atualizado_em", { ascending: false }).limit(15),
      supabase.from("hub_aprovacoes").select("*")
        .eq("status", "pendente").order("criado_em", { ascending: false }).limit(10),
      supabase.from("hub_alertas").select("*")
        .eq("resolvido", false).order("criado_em", { ascending: false }).limit(15),
    ]);
    if (l.data) setLeads(l.data as Lead[]);
    if (a.data) setAprovacoes(a.data as Aprovacao[]);
    if (al.data) setAlertas(al.data as Alerta[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("panel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_alertas" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar]);

  async function aprovar(id: string) {
    setProcessando(id);
    await supabase.from("hub_aprovacoes").update({ status: "aprovado", aprovado_por: "wendel", aprovado_em: new Date().toISOString() }).eq("id", id);
    await carregar();
    setProcessando(null);
  }

  async function rejeitar(id: string) {
    setProcessando(id);
    await supabase.from("hub_aprovacoes").update({ status: "rejeitado" }).eq("id", id);
    await carregar();
    setProcessando(null);
  }

  async function resolver(id: string) {
    setProcessando(id);
    await supabase.from("hub_alertas").update({ resolvido: true, resolvido_em: new Date().toISOString() }).eq("id", id);
    await carregar();
    setProcessando(null);
  }

  function tempo(d: string) {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    if (m < 1) return "agora";
    if (m < 60) return `${Math.round(m)}min`;
    return `${Math.round(m / 60)}h`;
  }

  function cor(d: string) {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    if (m > 15) return "#b3261e";
    if (m > 5) return "#c9a24a";
    return "#003b26";
  }

  const TIPO_ICON: Record<string, string> = {
    proposta: "📋", campanha: "📊", conteudo: "✏️",
    site: "🌐", ajuste_agente: "🤖", critico: "🚨",
  };

  const ALERTA_COR: Record<string, string> = {
    critico: "#b3261e",
    importante: "#c9a24a",
    sugestao: "#003b26",
    info: "#8b949e",
  };

  const criticos = alertas.filter(a => a.tipo === "critico").length;

  if (conversaAberta) {
    return (
      <div className="flex flex-col h-full" style={{ background: "#0d1117" }}>
        <ConversaInline lead={conversaAberta} onFechar={() => setConversaAberta(null)} />
        <div className="p-2" style={{ borderTop: "1px solid #30363d" }}>
          <button onClick={() => router.push(`/crm/leads/${conversaAberta.id}`)}
            className="w-full py-2 rounded-xl text-xs" style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
            Ver conversa completa →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d1117" }}>

      {/* TABS */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid #30363d" }}>
        {[
          { id: "leads" as const, label: "Leads", badge: leads.length, badgeCor: "#003b26" },
          { id: "aprovacoes" as const, label: "Aprovações", badge: aprovacoes.length, badgeCor: "#b3261e" },
          { id: "alertas" as const, label: "Alertas", badge: alertas.length, badgeCor: criticos > 0 ? "#b3261e" : "#c9a24a" },
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors"
            style={{
              color: aba === t.id ? "#c9a24a" : "#8b949e",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottomWidth: "2px",
              borderBottomStyle: "solid",
              borderBottomColor: aba === t.id ? "#c9a24a" : "transparent",
              cursor: "pointer",
            }}>
            {t.label}
            {t.badge > 0 && (
              <span className="w-5 h-5 rounded-full text-white flex items-center justify-center font-black"
                style={{ background: t.badgeCor, fontSize: "9px" }}>
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs" style={{ color: "#484f58" }}>Carregando...</p>
          </div>
        ) : (
          <>
            {/* ABA LEADS */}
            {aba === "leads" && (
              <div className="p-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leads.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-2xl mb-2">✓</p>
                    <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum lead ativo</p>
                    <p className="text-xs mt-1" style={{ color: "#484f58" }}>Aguardando mensagens</p>
                  </div>
                ) : leads.map(lead => (
                  <div key={lead.id} className="rounded-xl p-3"
                    style={{ background: "#161b22", border: "1px solid #30363d", borderLeft: `3px solid ${cor(lead.atualizado_em)}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-white font-bold text-sm truncate flex-1">{lead.nome}</p>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        {lead.valor_estimado > 0 && (
                          <span className="text-xs font-bold" style={{ color: "#c9a24a" }}>
                            R${(lead.valor_estimado / 1000).toFixed(0)}k
                          </span>
                        )}
                        <span className="text-xs" style={{ color: cor(lead.atualizado_em) }}>
                          {tempo(lead.atualizado_em)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mb-2" style={{ flexWrap: "wrap" }}>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#21262d", color: "#8b949e" }}>{lead.origem}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#21262d", color: "#8b949e" }}>{lead.estagio}</span>
                      {lead.agente_responsavel && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#003b2630", color: "#c9a24a" }}>
                          🤖 {lead.agente_responsavel}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setConversaAberta(lead)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: "#003b26", border: "none", cursor: "pointer" }}>
                        💬 Atender
                      </button>
                      <button onClick={() => router.push(`/crm/leads/${lead.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>→</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => router.push("/crm/leads")}
                  className="w-full py-2 rounded-xl text-xs font-bold"
                  style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                  Pipeline completo →
                </button>
              </div>
            )}

            {/* ABA APROVAÇÕES */}
            {aba === "aprovacoes" && (
              <div className="p-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {aprovacoes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-2xl mb-2">✓</p>
                    <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhuma pendente</p>
                    <p className="text-xs mt-1" style={{ color: "#484f58" }}>Todas as decisões em dia</p>
                  </div>
                ) : aprovacoes.map(ap => (
                  <div key={ap.id} className="rounded-xl p-3"
                    style={{ background: "#161b22", border: "1px solid #c9a24a44", borderLeft: "3px solid #c9a24a" }}>
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-base">{TIPO_ICON[ap.tipo] || "📌"}</span>
                        <p className="text-white font-bold text-sm truncate">{ap.descricao}</p>
                      </div>
                      {ap.valor_envolvido && ap.valor_envolvido > 0 && (
                        <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: "#c9a24a" }}>
                          R${(ap.valor_envolvido / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>
                    <p className="text-xs mb-2" style={{ color: "#8b949e" }}>{ap.motivo}</p>
                    <p className="text-xs mb-2" style={{ color: "#484f58" }}>
                      {ap.agente_slug} · {tempo(ap.criado_em)}
                    </p>
                    <div className="flex gap-1.5">
                      <button onClick={() => aprovar(ap.id)} disabled={processando === ap.id}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: "#003b26", border: "none", cursor: "pointer", opacity: processando === ap.id ? 0.5 : 1 }}>
                        {processando === ap.id ? "..." : "✓ Aprovar"}
                      </button>
                      <button onClick={() => rejeitar(ap.id)} disabled={processando === ap.id}
                        className="flex-1 py-1.5 rounded-lg text-xs"
                        style={{ background: "#21262d", color: "#b3261e", border: "none", cursor: "pointer", opacity: processando === ap.id ? 0.5 : 1 }}>
                        ✕ Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ABA ALERTAS */}
            {aba === "alertas" && (
              <div className="p-3" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alertas.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-2xl mb-2">✓</p>
                    <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum alerta</p>
                    <p className="text-xs mt-1" style={{ color: "#484f58" }}>Operação saudável</p>
                  </div>
                ) : alertas.map(al => {
                  const c = ALERTA_COR[al.tipo] || "#8b949e";
                  return (
                    <div key={al.id} className="rounded-xl p-3"
                      style={{ background: "#161b22", border: `1px solid ${c}33`, borderLeft: `3px solid ${c}` }}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: `${c}22`, color: c }}>{al.tipo}</span>
                            <span className="text-xs" style={{ color: "#484f58" }}>{al.agente_slug}</span>
                          </div>
                          <p className="text-white font-bold text-sm">{al.titulo}</p>
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#8b949e" }}>{al.mensagem}</p>
                        </div>
                        <button onClick={() => resolver(al.id)} disabled={processando === al.id}
                          className="ml-2 text-xs px-2 py-1 rounded-lg flex-shrink-0"
                          style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer", opacity: processando === al.id ? 0.5 : 1 }}>
                          {processando === al.id ? "..." : "Resolver"}
                        </button>
                      </div>
                      <p className="text-xs" style={{ color: "#484f58" }}>{tempo(al.criado_em)}</p>
                      {al.lead_id && (
                        <button onClick={() => router.push(`/crm/leads/${al.lead_id}`)}
                          className="mt-1.5 text-xs px-2 py-1 rounded-lg"
                          style={{ background: "#003b2622", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                          Ver lead →
                        </button>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => router.push("/crm/ciclos")}
                  className="w-full py-2 rounded-xl text-xs font-bold"
                  style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                  Central de Ciclos →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
