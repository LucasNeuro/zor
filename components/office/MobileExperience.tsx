"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMetricas } from "@/hooks/useMetricas";
import { supabase } from "@/lib/supabase/client";

// ── TYPES ─────────────────────────────────────────────────────
interface Popup {
  id: string;
  tipo: "critico" | "aprovacao" | "mensagem" | "notificacao" | "agente";
  prioridade: number;
  titulo: string;
  subtitulo?: string;
  conteudo: string;
  valor?: number;
  leadId?: string;
  aprovacaoId?: string;
  autoRemove?: number;
  dados?: Record<string, unknown>;
}

interface Conversa {
  leadId: string;
  nome: string;
  mercado: string;
  mensagens: Array<{
    id: string;
    conteudo: string;
    direcao: string;
    criado_em: string;
    agente_id?: string;
  }>;
}

// ── MERCADO CONFIG ─────────────────────────────────────────────
const MERCADO: Record<string, { emoji: string; cor: string }> = {
  imobiliario: { emoji: "🏠", cor: "#8b5cf6" },
  arquitetura: { emoji: "🏛", cor: "#f59e0b" },
  reforma: { emoji: "🔨", cor: "#f97316" },
  fornecedor: { emoji: "🤝", cor: "#22c55e" },
  produto: { emoji: "📦", cor: "#06b6d4" },
  geral: { emoji: "📌", cor: "#6b7280" },
};

function tempoRelativo(data: string): string {
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  return `${Math.round(diff / 3600)}h`;
}

// ── POPUP COMPONENT ────────────────────────────────────────────
function PopupCard({
  popup,
  onDismiss,
  onAcao,
}: {
  popup: Popup;
  onDismiss: (id: string) => void;
  onAcao: (popup: Popup, acao: string) => void;
}) {
  const [saindo, setSaindo] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);

  useEffect(() => {
    if (popup.autoRemove) {
      const t = setTimeout(() => fechar(), popup.autoRemove);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fechar() {
    setSaindo(true);
    setTimeout(() => onDismiss(popup.id), 300);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    setSwipeX(e.touches[0].clientX - startX.current);
  }

  function onTouchEnd() {
    if (swipeX > 80) { onAcao(popup, "aprovar"); fechar(); }
    else if (swipeX < -80) { onAcao(popup, "rejeitar"); fechar(); }
    else setSwipeX(0);
  }

  const corBorda = popup.tipo === "critico" ? "#b3261e" :
    popup.tipo === "aprovacao" ? "#c9a24a" :
    popup.tipo === "mensagem" ? "#003b26" : "#30363d";

  const animStyle = saindo
    ? { animation: "slideDown 0.3s ease forwards" }
    : { animation: "slideUp 0.3s ease forwards" };

  return (
    <div
      style={{
        background: "#161b22",
        border: `1px solid ${corBorda}`,
        borderLeft: `4px solid ${corBorda}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        transform: `translateX(${swipeX}px)`,
        transition: swipeX === 0 ? "transform 0.2s ease" : "none",
        opacity: Math.max(0, 1 - Math.abs(swipeX) / 200),
        ...animStyle,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ padding: 12 }}>
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {popup.tipo === "critico" ? "🔴" :
               popup.tipo === "aprovacao" ? "✅" :
               popup.tipo === "mensagem" ? "💬" : "🔔"}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{popup.titulo}</p>
              {popup.subtitulo && (
                <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{popup.subtitulo}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
            {popup.valor && popup.valor > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a24a" }}>
                R$ {(popup.valor / 1000).toFixed(0)}k
              </span>
            )}
            <button onClick={fechar} style={{ color: "#484f58", fontSize: 18, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12, lineHeight: 1.4, margin: "0 0 12px 0" }}>{popup.conteudo}</p>

        {/* AÇÕES */}
        <div style={{ display: "flex", gap: 8 }}>
          {popup.tipo === "critico" && (
            <button
              onClick={() => { onAcao(popup, "assumir"); fechar(); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#b3261e", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Assumir agora
            </button>
          )}
          {popup.tipo === "mensagem" && (
            <>
              <button
                onClick={() => { onAcao(popup, "responder"); fechar(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#003b26", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Responder
              </button>
              <button
                onClick={() => { onAcao(popup, "ver"); fechar(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#21262d", border: "none", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Ver conversa
              </button>
            </>
          )}
          {popup.tipo === "aprovacao" && (
            <>
              <button
                onClick={() => { onAcao(popup, "aprovar"); fechar(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#003b26", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                ✓ Aprovar
              </button>
              <button
                onClick={() => { onAcao(popup, "rejeitar"); fechar(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#21262d", border: "1px solid #b3261e", color: "#b3261e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                ✕ Rejeitar
              </button>
            </>
          )}
          {popup.tipo === "notificacao" && (
            <button
              onClick={() => { onAcao(popup, "ver"); fechar(); }}
              style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "#21262d", border: "none", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Ver →
            </button>
          )}
        </div>

        {popup.tipo === "aprovacao" && (
          <p style={{ textAlign: "center", fontSize: 10, color: "#484f58", marginTop: 8, marginBottom: 0 }}>
            ← rejeitar · aprovar →
          </p>
        )}
      </div>
    </div>
  );
}

// ── BOTTOM SHEET CONVERSA ──────────────────────────────────────
function BottomSheetConversa({
  conversa,
  onFechar,
  onAssumir,
}: {
  conversa: Conversa;
  onFechar: () => void;
  onAssumir: () => void;
}) {
  const [resposta, setResposta] = useState("");
  const [assumido, setAssumido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const startY = useRef(0);
  const [swipeY, setSwipeY] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setSwipeY(delta);
  }

  function onTouchEnd() {
    if (swipeY > 100) onFechar();
    else setSwipeY(0);
  }

  async function assumir() {
    await supabase
      .from("hub_leads_crm")
      .update({ humano_responsavel: "wendel" })
      .eq("id", conversa.leadId);
    setAssumido(true);
    onAssumir();
  }

  async function enviar() {
    if (!resposta.trim() || !assumido) return;
    setEnviando(true);
    await supabase.from("hub_fila_mensagens").insert({
      lead_id: conversa.leadId,
      agente_id: "wendel",
      canal: "whatsapp",
      direcao: "saida",
      conteudo: resposta,
      status: "enviado",
      metadata: { feito_por: "humano" },
    });
    setResposta("");
    setEnviando(false);
  }

  const mercadoConf = MERCADO[conversa.mercado] || MERCADO.geral;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.7)" }}>
      <div style={{ flex: 1 }} onClick={onFechar} />
      <div
        style={{
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#161b22",
          maxHeight: "85vh",
          transform: `translateY(${swipeY}px)`,
          transition: swipeY === 0 ? "transform 0.3s ease" : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* DRAG HANDLE */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#30363d" }} />
        </div>

        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #30363d" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{mercadoConf.emoji}</span>
            <div>
              <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, margin: 0 }}>{conversa.nome}</p>
              <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{conversa.mercado}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!assumido ? (
              <button onClick={assumir} style={{ padding: "6px 12px", borderRadius: 12, background: "#c9a24a", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Assumir
              </button>
            ) : (
              <span style={{ padding: "6px 12px", borderRadius: 12, background: "#003b26", color: "#c9a24a", fontSize: 12, fontWeight: 700 }}>✓ Você</span>
            )}
            <button onClick={onFechar} style={{ color: "#484f58", fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* MENSAGENS */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          {conversa.mensagens.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 13, color: "#484f58" }}>Nenhuma mensagem ainda</p>
          ) : conversa.mensagens.map(msg => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.direcao === "saida" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%",
                padding: "8px 12px",
                background: msg.direcao === "saida" ? "#003b26" : "#21262d",
                color: "#e6edf3",
                borderRadius: msg.direcao === "saida" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                fontSize: 14,
              }}>
                <p style={{ margin: 0 }}>{msg.conteudo}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "#484f58" }}>
                  {tempoRelativo(msg.criado_em)}
                  {msg.agente_id && msg.agente_id !== "wendel" && ` · ${msg.agente_id}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* INPUT */}
        <div style={{ padding: 12, borderTop: "1px solid #30363d" }}>
          {!assumido ? (
            <button onClick={assumir} style={{ width: "100%", padding: "12px 0", borderRadius: 16, background: "#c9a24a", border: "none", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Assumir atendimento para responder
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={resposta}
                onChange={e => setResposta(e.target.value)}
                placeholder="Digite sua mensagem..."
                style={{ flex: 1, borderRadius: 16, padding: "12px 16px", fontSize: 14, background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", outline: "none" }}
                onKeyDown={e => { if (e.key === "Enter") enviar(); }}
              />
              <button
                onClick={enviar}
                disabled={!resposta.trim() || enviando}
                style={{ width: 48, height: 48, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: enviando ? "#30363d" : "#003b26", border: "none", color: "white", fontSize: 18, cursor: "pointer", flexShrink: 0 }}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MENU OVERLAY ───────────────────────────────────────────────
function MenuOverlay({
  visivel,
  metricas,
  onNavegar,
}: {
  visivel: boolean;
  metricas: Record<string, number>;
  onNavegar: (rota: string) => void;
}) {
  if (!visivel) return null;

  return (
    <div style={{ position: "fixed", inset: "0 0 auto 0", zIndex: 40, animation: "fadeInScale 0.2s ease" }}>
      {/* HEADER */}
      <div style={{ padding: "48px 16px 12px", background: "linear-gradient(to bottom, #0d1117, transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontWeight: 900, fontSize: 20, color: "#c9a24a", margin: 0, lineHeight: 1 }}>OBRA10+</h1>
            <p style={{ fontSize: 11, color: "#8b949e", margin: 0 }}>Escritório Virtual</p>
          </div>
          {metricas.criticos > 0 && (
            <div style={{ padding: "4px 10px", borderRadius: 999, background: "#b3261e", color: "white", fontSize: 11, fontWeight: 700 }}>
              🔴 {metricas.criticos} críticos
            </div>
          )}
        </div>

        {/* MÉTRICAS */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { label: "Online", valor: metricas.online, rota: "/crm/agentes" },
            { label: "Conversas", valor: metricas.conversas || 0, rota: "/crm/atendimento" },
            { label: "Pendentes", valor: metricas.aprovacoes || 0, rota: "/crm/aprovacoes" },
            { label: "Leads", valor: metricas.leads || 0, rota: "/crm/leads" },
          ].map(m => (
            <button
              key={m.label}
              onClick={() => onNavegar(m.rota)}
              style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 12, background: "#161b22", border: "1px solid #30363d", cursor: "pointer", textAlign: "center" }}
            >
              <p style={{ fontWeight: 900, fontSize: 20, color: m.valor > 0 ? "#c9a24a" : "#e6edf3", margin: 0, lineHeight: 1 }}>{m.valor}</p>
              <p style={{ fontSize: 10, color: "#8b949e", margin: 0 }}>{m.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────
function BottomNav({ metricas, onNavegar, visivel }: { metricas: Record<string, number>; onNavegar: (r: string) => void; visivel: boolean }) {
  if (!visivel) return null;

  return (
    <div style={{ position: "fixed", inset: "auto 0 0 0", zIndex: 40, padding: "8px 8px 24px", background: "linear-gradient(to top, #0d1117 80%, transparent)" }}>
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 16, background: "rgba(22,27,34,0.95)", border: "1px solid #30363d" }}>
        {[
          { icon: "🏢", label: "Office", rota: "/office" },
          { icon: "👥", label: "Leads", rota: "/crm/leads" },
          { icon: "💬", label: "Chat", rota: "/crm/atendimento" },
          { icon: "✅", label: "Aprov.", rota: "/crm/aprovacoes", badge: metricas.aprovacoes },
          { icon: "🤖", label: "Agentes", rota: "/crm/agentes" },
        ].map(item => (
          <button
            key={item.rota}
            onClick={() => onNavegar(item.rota)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px", borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", position: "relative" }}
          >
            <div style={{ position: "relative" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              {item.badge && item.badge > 0 ? (
                <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#b3261e", color: "white", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 10, color: "#8b949e" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
export default function MobileExperience() {
  const router = useRouter();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [menuVisivel, setMenuVisivel] = useState(false);
  const [conversaAberta, setConversaAberta] = useState<Conversa | null>(null);
  const hookMetricas = useMetricas();
  const metricas = {
    criticos: hookMetricas.leadsAguardando,
    conversas: hookMetricas.conversasAtivas,
    aprovacoes: hookMetricas.aprovacoesPendentes,
    leads: hookMetricas.leadsHoje,
    online: hookMetricas.agentesAtivos,
  };
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastScrollY = useRef(0);
  const popupCounter = useRef(0);

  const addPopup = useCallback((popup: Omit<Popup, "id">) => {
    const id = `popup_${++popupCounter.current}_${Date.now()}`;
    setPopups(prev => [{ ...popup, id }, ...prev].slice(0, 3));
  }, []);

  useEffect(() => {
    const subMsg = supabase
      .channel("mobile-mensagens")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_fila_mensagens" }, async (payload) => {
        const msg = payload.new as Record<string, unknown>;
        if (msg.direcao !== "entrada") return;

        const meta = (msg.metadata as Record<string, unknown>) || {};
        const mercado = (meta.mercado as string) || "geral";
        const nome = (meta.pushName as string) || "Novo lead";
        const conf = MERCADO[mercado] || MERCADO.geral;

        addPopup({
          tipo: "mensagem",
          prioridade: 2,
          titulo: `${conf.emoji} ${nome}`,
          subtitulo: mercado,
          conteudo: ((msg.conteudo as string) || "").slice(0, 80),
          leadId: msg.lead_id as string,
          autoRemove: 10000,
          dados: { mercado },
        });
      })
      .subscribe();

    const subAprov = supabase
      .channel("mobile-aprovacoes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_aprovacoes" }, async (payload) => {
        const ap = payload.new as Record<string, unknown>;
        addPopup({
          tipo: "aprovacao",
          prioridade: 1,
          titulo: (ap.descricao as string) || "Nova aprovação",
          subtitulo: ap.agente_slug as string,
          conteudo: (ap.motivo as string) || "Requer sua decisão",
          valor: (ap.valor_envolvido as number) || 0,
          aprovacaoId: ap.id as string,
          dados: ap,
        });
      })
      .subscribe();

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("hub_fila_mensagens")
        .select("*, lead:hub_leads_crm(nome)")
        .eq("status", "pendente")
        .eq("direcao", "entrada");

      const criticos = (data || []).filter(m => {
        const mins = (Date.now() - new Date(m.criado_em).getTime()) / 1000 / 60;
        return mins > 15;
      });

      if (criticos.length > 0) {
        const c = criticos[0];
        addPopup({
          tipo: "critico",
          prioridade: 0,
          titulo: "Lead sem resposta",
          subtitulo: `${criticos.length} lead${criticos.length > 1 ? "s" : ""} aguardando`,
          conteudo: ((c.lead as Record<string, unknown>)?.nome as string) || "Lead há mais de 15 minutos",
          leadId: c.lead_id as string,
          dados: { total: criticos.length },
        });
      }

    }, 30000);

    return () => {
      supabase.removeChannel(subMsg);
      supabase.removeChannel(subAprov);
      clearInterval(interval);
    };
  }, [addPopup]);

  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      const scrollingUp = currentY < lastScrollY.current;
      lastScrollY.current = currentY;

      if (scrollingUp || currentY < 30) {
        setMenuVisivel(true);
        clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => setMenuVisivel(false), 3000);
      } else {
        setMenuVisivel(false);
      }
    }

    function handleTouch() {
      setMenuVisivel(true);
      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setMenuVisivel(false), 4000);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchstart", handleTouch, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouch);
    };
  }, []);

  async function handleAcao(popup: Popup, acao: string) {
    if ((acao === "assumir" || acao === "ver" || acao === "responder") && popup.leadId) {
      const [lead, msgs] = await Promise.all([
        supabase.from("hub_leads_crm").select("*").eq("id", popup.leadId).single(),
        supabase.from("hub_fila_mensagens").select("*").eq("lead_id", popup.leadId).order("criado_em", { ascending: true }).limit(50),
      ]);

      if (lead.data) {
        const meta = (popup.dados || {}) as Record<string, unknown>;
        setConversaAberta({
          leadId: popup.leadId,
          nome: lead.data.nome,
          mercado: (meta.mercado as string) || "geral",
          mensagens: (msgs.data || []) as Conversa["mensagens"],
        });
      }
    }

    if (acao === "aprovar" && popup.aprovacaoId) {
      await supabase.from("hub_aprovacoes").update({
        status: "aprovado",
        aprovado_por: "wendel",
        aprovado_em: new Date().toISOString(),
      }).eq("id", popup.aprovacaoId);
    }

    if (acao === "rejeitar" && popup.aprovacaoId) {
      await supabase.from("hub_aprovacoes").update({
        status: "rejeitado",
      }).eq("id", popup.aprovacaoId);
    }
  }

  function removePopup(id: string) {
    setPopups(prev => prev.filter(p => p.id !== id));
  }

  function navegar(rota: string) {
    router.push(rota);
  }

  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100svh", background: "#0d1117", overflow: "hidden" }}>

      {/* FUNDO */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "#0d1117" }} />


      {/* STACK DE POPUPS */}
      <div style={{ position: "fixed", bottom: 96, left: 12, right: 12, zIndex: 30, display: "flex", flexDirection: "column-reverse", gap: 8 }}>
        {[...popups]
          .sort((a, b) => a.prioridade - b.prioridade)
          .map(popup => (
            <PopupCard
              key={popup.id}
              popup={popup}
              onDismiss={removePopup}
              onAcao={handleAcao}
            />
          ))}
      </div>

      {/* MENU E NAV */}
      <MenuOverlay visivel={menuVisivel} metricas={metricas} onNavegar={navegar} />
      <BottomNav visivel={menuVisivel} metricas={metricas} onNavegar={navegar} />

      {/* BOTTOM SHEET CONVERSA */}
      {conversaAberta && (
        <BottomSheetConversa
          conversa={conversaAberta}
          onFechar={() => setConversaAberta(null)}
          onAssumir={() => {}}
        />
      )}
    </div>
  );
}
