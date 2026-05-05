"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Brand palette (dark premium) ─────────────────────────────────────────────
const C = {
  bg:         "#161b22",
  green:      "#003b26",
  gold:       "#c9a24a",
  goldBg:     "rgba(201,162,74,0.10)",
  red:        "#b3261e",
  redSoft:    "rgba(179,38,30,0.15)",
  text:       "#e6edf3",
  muted:      "#8b949e",
  line:       "#30363d",
  white:      "#21262d",
  greenMoney: "#34d399",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "decisoes" | "crm" | "aprovacoes" | "gargalos" | "alertas";

interface Aprovacao {
  id: string;
  tipo: string;
  agente_slug: string;
  agente_nome?: string;
  descricao: string;
  motivo: string;
  impacto?: string;
  recomendacao?: string;
  confianca_ia?: number;
  lead_id?: string;
  valor_envolvido?: number;
  prazo?: string;
  status: string;
  criado_em: string;
}

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  origem?: string;
  estagio: string;
  score: number;
  valor_estimado?: number;
  humano_responsavel?: string;
  criado_em: string;
  atualizado_em: string;
}

// ─── Static data (not in DB yet) ──────────────────────────────────────────────
const GARGALOS = [
  { id: "g1", titulo: "Aprovação manual bloqueando", descricao: "3 peças aguardando há mais de 1h", area: "Conteúdo", impacto: "alto" as const, acao: "Revisar aprovações pendentes" },
  { id: "g2", titulo: "Budget esgotando", descricao: "Campanha Google com 90% do budget consumido", area: "Tráfego", impacto: "medio" as const, acao: "Ampliar budget ou pausar conjunto" },
];

const ALERTAS = [
  { id: "al1", msg: "Lead #247 sem resposta há 22min — SLA estourado", tipo: "critico" as const, link: "/crm/leads" },
  { id: "al2", msg: "ROAS Meta Ads caiu para 2.8x (meta: 3.5x)", tipo: "atencao" as const },
  { id: "al3", msg: "Ariane processou 340 msgs hoje — recorde", tipo: "info" as const },
  { id: "al4", msg: "Novo lead alto valor: Construtora ABC R$1.2M", tipo: "info" as const, link: "/crm/leads" },
];

const ORIGEM_COR: Record<string, string> = {
  whatsapp: "#22c55e", indicacao: C.gold, meta_ads: "#818cf8",
  google: "#f59e0b", google_ads: "#f59e0b", organico: C.green,
};

const TIPO_ICON: Record<string, string> = {
  proposta: "📋", campanha: "📊", conteudo: "✏️", site: "🌐",
  ajuste_agente: "🤖", trafego: "📈", contrato: "📜", financeiro: "💰",
  atendimento_critico: "🚨", atendimento: "💬",
};

const ESTAGIO_LABEL: Record<string, string> = {
  novo: "Novo", qualificacao: "Qualificação", proposta: "Proposta",
  negociacao: "Negociação", fechamento: "Fechamento", pos_venda: "Pós-venda",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rel(d: string) {
  const m = (Date.now() - new Date(d).getTime()) / 60000;
  return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : `${Math.round(m / 60)}h`;
}

function moeda(v: number) {
  return v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toLocaleString("pt-BR")}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo }: { msg: string; tipo: "ok" | "erro" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: tipo === "ok" ? C.green : C.red,
      color: "#fff", padding: "10px 18px", borderRadius: 10,
      fontSize: 12, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,40,26,0.22)",
      animation: "fadeInUp 0.25s ease",
    }}>
      {tipo === "ok" ? "✓ " : "✕ "}{msg}
    </div>
  );
}

// ─── Slide-over: Ver análise ──────────────────────────────────────────────────
function AnaliseSlideOver({
  item, onClose, onAprovar, onIgnorar, loading,
}: {
  item: Aprovacao;
  onClose: () => void;
  onAprovar: () => void;
  onIgnorar: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,0.38)" }} onClick={onClose} />
      <div style={{
        width: 340, background: C.bg, height: "100%",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
      }}
      className="scrollbar-soft"
      >
        {/* Header */}
        <div style={{
          background: C.green, padding: "16px 18px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              {TIPO_ICON[item.tipo] || "📌"} {item.tipo}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{item.descricao}</div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.12)", border: "none", color: "#fff",
            width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
            fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {item.motivo && (
            <div style={{ background: C.white, borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>O que a IA observou</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{item.motivo}</div>
            </div>
          )}
          {item.recomendacao && (
            <div style={{ background: C.white, borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)", borderLeft: `3px solid ${C.gold}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Recomendação</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{item.recomendacao}</div>
            </div>
          )}
          {item.impacto && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                flex: 1, background: C.white, borderRadius: 10, padding: "10px 12px",
                boxShadow: "0 1px 4px rgba(0,40,26,0.06)",
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Impacto</div>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: item.impacto === "alto" || item.impacto === "critico" ? C.red : C.gold,
                }}>
                  {item.impacto.toUpperCase()}
                </div>
              </div>
              {item.confianca_ia && (
                <div style={{ flex: 1, background: C.white, borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Confiança IA</div>
                  <div style={{ height: 5, background: C.line, borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                    <div style={{ height: "100%", width: `${item.confianca_ia}%`, background: C.gold, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gold }}>{item.confianca_ia}%</div>
                </div>
              )}
            </div>
          )}
          {item.valor_envolvido && item.valor_envolvido > 0 && (
            <div style={{ background: C.white, borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.muted }}>Valor envolvido</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{moeda(item.valor_envolvido)}</span>
            </div>
          )}
          <div style={{ background: C.white, borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>Solicitante</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>{item.agente_nome || item.agente_slug}</span>
          </div>
          <div style={{ background: C.white, borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,40,26,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>Aguardando há</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{rel(item.criado_em)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "14px 18px", borderTop: `1px solid ${C.line}`,
          background: "rgba(247,244,236,0.8)", flexShrink: 0,
          display: "flex", gap: 8,
        }}>
          <button
            onClick={onAprovar}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              background: loading ? C.line : C.green, border: "none",
              color: loading ? C.muted : "#fff",
              fontSize: 11, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Aprovando..." : "✓ Aprovar"}
          </button>
          <button
            onClick={onIgnorar}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              background: "transparent", border: `1px solid ${C.line}`,
              color: C.muted, fontSize: 11, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Ignorar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agendar modal ────────────────────────────────────────────────────────────
function AgendarModal({
  leadId, leadNome, onClose, onSaved,
}: {
  leadId: string;
  leadNome: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!data || !hora) return;
    setSaving(true);
    try {
      await fetch("/api/atividades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, data, hora, notas }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${C.line}`, background: C.white,
    fontSize: 13, color: C.text, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div style={{
        position: "relative", zIndex: 1,
        background: C.bg, borderRadius: 16, padding: 24, width: 320,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>Agendar reunião</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>com {leadNome}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Horário</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Observações</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Assunto, contexto..."
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            onClick={salvar}
            disabled={saving || !data || !hora}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              background: saving || !data || !hora ? C.line : C.green,
              border: "none", color: saving || !data || !hora ? C.muted : "#fff",
              fontSize: 12, fontWeight: 700, cursor: saving || !data || !hora ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8,
              background: "transparent", border: `1px solid ${C.line}`,
              color: C.muted, fontSize: 12, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DecisionPanel() {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>("decisoes");
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [btnLoading, setBtnLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast]           = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);
  const [slideOver, setSlideOver]   = useState<Aprovacao | null>(null);
  const [agendarModal, setAgendarModal] = useState<{ leadId: string; leadNome: string } | null>(null);
  const [saindo, setSaindo]         = useState<Set<string>>(new Set());
  const [alertIgn, setAlertIgn]     = useState<Record<string, number>>({}); // id → expires ms

  function showToast(msg: string, tipo: "ok" | "erro" = "ok") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  function animarSaida(id: string) {
    setSaindo(p => new Set([...p, id]));
    setTimeout(() => {
      setAprovacoes(prev => prev.filter(a => a.id !== id));
      setSaindo(p => { const n = new Set(p); n.delete(id); return n; });
    }, 260);
  }

  useEffect(() => {
    fetch("/api/aprovacoes").then(r => r.json()).then(d => Array.isArray(d) && setAprovacoes(d)).catch(() => {});
    fetch("/api/leads").then(r => r.json()).then(d => Array.isArray(d) && setLeads(d)).catch(() => {});

    const subAp = sb.channel("dp_aprovacoes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_aprovacoes" }, ({ new: row }) => {
        const ap = row as Aprovacao;
        if (ap.status === "pendente") {
          setAprovacoes(prev => [ap, ...prev]);
          showToast("Nova aprovação pendente");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hub_aprovacoes" }, ({ new: row }) => {
        const ap = row as Aprovacao;
        if (ap.status !== "pendente") setAprovacoes(prev => prev.filter(a => a.id !== ap.id));
      })
      .subscribe();

    const subLeads = sb.channel("dp_leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, () => {
        fetch("/api/leads").then(r => r.json()).then(d => Array.isArray(d) && setLeads(d)).catch(() => {});
      })
      .subscribe();

    return () => {
      sb.removeChannel(subAp);
      sb.removeChannel(subLeads);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function aprovar(id: string) {
    setBtnLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/aprovacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aprovado", aprovado_por: "wendel" }),
      });
      if (res.ok) {
        animarSaida(id);
        showToast("Aprovado com sucesso");
        if (slideOver?.id === id) setSlideOver(null);
      } else {
        showToast("Erro ao aprovar", "erro");
      }
    } finally {
      setBtnLoading(p => ({ ...p, [id]: false }));
    }
  }

  async function ignorar(id: string) {
    setBtnLoading(p => ({ ...p, [`ig_${id}`]: true }));
    try {
      await fetch(`/api/aprovacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ignorado" }),
      });
      animarSaida(id);
      if (slideOver?.id === id) setSlideOver(null);
    } finally {
      setBtnLoading(p => ({ ...p, [`ig_${id}`]: false }));
    }
  }

  async function assumirLead(lead: Lead) {
    if (lead.telefone) {
      const num = `55${lead.telefone.replace(/\D/g, "")}`;
      window.open(`https://wa.me/${num}`, "_blank");
    }
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, humano_responsavel: "wendel" }),
    });
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, humano_responsavel: "wendel" } : l));
    showToast(`Assumindo ${lead.nome}`);
  }

  // Counts
  const agora = Date.now();
  const alertsVisiveis = ALERTAS.filter(a => !alertIgn[a.id] || alertIgn[a.id] < agora);
  const tipoGroups = aprovacoes.reduce((acc, a) => { acc[a.tipo] = (acc[a.tipo] || 0) + 1; return acc; }, {} as Record<string, number>);

  const TABS: { id: Tab; label: string; count: number; hasUrgent?: boolean }[] = [
    { id: "decisoes",   label: "Decisões",   count: aprovacoes.length, hasUrgent: aprovacoes.some(a => a.impacto === "alto" || a.impacto === "critico") },
    { id: "crm",        label: "CRM",        count: leads.length },
    { id: "aprovacoes", label: "Aprov.", count: aprovacoes.length, hasUrgent: aprovacoes.length > 0 },
    { id: "gargalos",   label: "Gargalos",   count: GARGALOS.length,   hasUrgent: true },
    { id: "alertas",    label: "Alertas",    count: alertsVisiveis.length, hasUrgent: alertsVisiveis.some(a => a.tipo === "critico") },
  ];

  // Shared card wrapper
  const card = (children: React.ReactNode, opts: { id?: string; borderCol?: string; exiting?: boolean } = {}) => (
    <div style={{
      margin: "10px 10px 0",
      background: C.white,
      borderRadius: 10,
      borderLeft: `3px solid ${opts.borderCol ?? C.line}`,
      boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
      overflow: "hidden",
      transition: "opacity 250ms, transform 250ms",
      opacity: opts.exiting ? 0 : 1,
      transform: opts.exiting ? "translateX(20px)" : "none",
    }}>
      {children}
    </div>
  );

  const actionBar = (children: React.ReactNode) => (
    <div style={{
      display: "flex", gap: 6, padding: "8px 10px",
      borderTop: `1px solid ${C.line}`, background: "rgba(247,244,236,0.6)",
    }}>
      {children}
    </div>
  );

  const btn = (label: string, onClick: () => void, opts: { primary?: boolean; danger?: boolean; ghost?: boolean; disabled?: boolean; flex?: number } = {}) => {
    const bg = opts.disabled ? C.line : opts.primary ? C.green : opts.danger ? "transparent" : "transparent";
    const color = opts.disabled ? C.muted : opts.primary ? "#fff" : opts.danger ? C.red : C.muted;
    const border = opts.primary || opts.disabled ? "none" : `1px solid ${opts.danger ? C.red + "66" : C.line}`;
    return (
      <button
        onClick={opts.disabled ? undefined : onClick}
        disabled={opts.disabled}
        style={{
          flex: opts.flex ?? 1, padding: "5px 0", borderRadius: 6,
          background: bg, border, color,
          fontSize: 10, fontWeight: opts.primary ? 700 : 600,
          cursor: opts.disabled ? "not-allowed" : "pointer",
          transition: "opacity 150ms",
        }}
        onMouseOver={e => !opts.disabled && (e.currentTarget.style.opacity = "0.8")}
        onMouseOut={e => (e.currentTarget.style.opacity = "1")}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>

        {/* ── Tab bar ─── */}
        <div style={{ display: "flex", background: "#0d1117", borderBottom: `1px solid ${C.line}`, flexShrink: 0, overflow: "hidden" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            const badgeBg = active ? C.gold : t.hasUrgent ? C.red : "rgba(255,255,255,0.14)";
            const badgeColor = active ? C.green : "#fff";
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, padding: "8px 2px 6px",
                background: "transparent", border: "none",
                borderBottom: `2px solid ${active ? C.gold : "transparent"}`,
                cursor: "pointer", transition: "border-color 150ms", minWidth: 0,
              }}>
                <span style={{
                  fontSize: 8.5, fontWeight: active ? 700 : 500,
                  color: active ? C.gold : "rgba(255,255,255,0.55)",
                  lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px",
                }}>
                  {t.label}
                </span>
                {t.count > 0 && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, minWidth: 14, textAlign: "center",
                    padding: "1px 4px", borderRadius: 10, lineHeight: 1.5,
                    background: badgeBg, color: badgeColor,
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ─── */}
        <div className="scrollbar-soft" style={{ flex: 1, overflowY: "auto" }}>

          {/* DECISÕES */}
          {tab === "decisoes" && (
            <div>
              {aprovacoes.length === 0 && (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Tudo resolvido</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Operação saudável</div>
                </div>
              )}
              {aprovacoes.map(d => {
                const isUrgent = d.impacto === "alto" || d.impacto === "critico";
                const borderCol = isUrgent ? C.red : C.gold;
                const isExiting = saindo.has(d.id);
                return card(
                  <>
                    <div style={{ padding: "10px 12px 6px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                        {isUrgent && (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: C.redSoft, color: C.red, flexShrink: 0, marginTop: 2, letterSpacing: "0.04em" }}>
                            URGENTE
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.green, lineHeight: 1.3 }}>
                          {TIPO_ICON[d.tipo] || "📌"} {d.descricao}
                        </span>
                      </div>
                      <p style={{ fontSize: 10.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>{d.motivo}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                        <span style={{ fontSize: 9.5, color: C.muted }}>{d.agente_nome || d.agente_slug}</span>
                        <span style={{ fontSize: 9, color: C.line }}>·</span>
                        <span style={{ fontSize: 9.5, color: C.muted }}>{rel(d.criado_em)}</span>
                        {d.valor_envolvido && d.valor_envolvido > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginLeft: "auto" }}>
                            {moeda(d.valor_envolvido)}
                          </span>
                        )}
                      </div>
                    </div>
                    {actionBar(<>
                      {btn(btnLoading[d.id] ? "Aprovando..." : "Aprovar", () => aprovar(d.id), { primary: true, disabled: btnLoading[d.id] })}
                      {btn("Ver análise", () => setSlideOver(d), { disabled: btnLoading[d.id] })}
                      {btn("Ignorar", () => ignorar(d.id), { ghost: true, disabled: btnLoading[`ig_${d.id}`], flex: 0.7 })}
                    </>)}
                  </>,
                  { id: d.id, borderCol, exiting: isExiting }
                );
              })}
              <div style={{ height: 10 }} />
            </div>
          )}

          {/* CRM */}
          {tab === "crm" && (
            <div>
              {leads.length === 0 && (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Sem leads ativos</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Nenhum lead no funil</div>
                </div>
              )}
              {leads.map(l => {
                const tempo = rel(l.atualizado_em);
                const isCritico = tempo.includes("h") || (tempo.includes("min") && parseInt(tempo) > 30);
                const tempoColor = isCritico ? C.red : C.muted;
                const origemKey = (l.origem ?? "").toLowerCase().replace(/\s+/g, "_");
                const origemCor = ORIGEM_COR[origemKey] ?? C.gold;
                const jaAssumido = l.humano_responsavel === "wendel";
                return card(
                  <>
                    <div style={{ padding: "10px 12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.green }}>{l.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.greenMoney }}>{moeda(l.valor_estimado ?? 0)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {l.origem && (
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: `${origemCor}1a`, color: origemCor, flexShrink: 0 }}>
                            {l.origem}
                          </span>
                        )}
                        <span style={{ fontSize: 9.5, color: C.muted }}>{ESTAGIO_LABEL[l.estagio] ?? l.estagio}</span>
                        <span style={{ fontSize: 9.5, color: tempoColor, marginLeft: "auto", fontWeight: isCritico ? 700 : 400 }}>
                          {isCritico ? "⚠ " : ""}{tempo}
                        </span>
                      </div>
                    </div>
                    {actionBar(<>
                      {btn(jaAssumido ? "✓ Assumido" : "Assumir", () => assumirLead(l), { primary: !jaAssumido, disabled: jaAssumido })}
                      {btn("Ver conversa", () => router.push(`/crm/atendimento?lead=${l.id}`))}
                      {btn("Agendar", () => setAgendarModal({ leadId: l.id, leadNome: l.nome }), { flex: 0.8 })}
                    </>)}
                  </>,
                  { id: l.id, borderCol: isCritico ? C.red : C.gold }
                );
              })}
              <div style={{ height: 10 }} />
            </div>
          )}

          {/* APROVAÇÕES — grouped by tipo */}
          {tab === "aprovacoes" && (
            <div>
              {aprovacoes.length === 0 && (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Nenhuma aprovação pendente</div>
                </div>
              )}
              {Object.entries(tipoGroups).map(([tipo, count]) => (
                <div key={tipo} style={{
                  margin: "10px 10px 0", background: C.white, borderRadius: 10,
                  borderLeft: `3px solid ${C.gold}`,
                  boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{TIPO_ICON[tipo] || "📌"}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{count} pendente{count > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.red, padding: "2px 8px", borderRadius: 10, background: C.redSoft }}>
                      {count}
                    </span>
                    <button
                      onClick={() => router.push(`/crm/aprovacoes?tipo=${tipo}`)}
                      style={{
                        padding: "5px 12px", borderRadius: 6,
                        background: C.green, border: "none", color: "#fff",
                        fontSize: 10, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      Revisar →
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ height: 10 }} />
            </div>
          )}

          {/* GARGALOS */}
          {tab === "gargalos" && (
            <div>
              {GARGALOS.map(g => (
                <div key={g.id} style={{
                  margin: "10px 10px 0", background: C.white, borderRadius: 10,
                  borderLeft: `3px solid ${g.impacto === "alto" ? C.red : C.gold}`,
                  boxShadow: "0 1px 4px rgba(0,40,26,0.07)", overflow: "hidden",
                }}>
                  <div style={{ padding: "10px 12px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                        background: g.impacto === "alto" ? C.redSoft : "rgba(201,162,74,0.08)",
                        color: g.impacto === "alto" ? C.red : C.gold,
                      }}>
                        {g.impacto === "alto" ? "ALTO" : "MÉDIO"}
                      </span>
                      <span style={{ fontSize: 9.5, color: C.muted }}>{g.area}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 3 }}>{g.titulo}</div>
                    <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, marginBottom: 4 }}>{g.descricao}</div>
                    <div style={{ fontSize: 9.5, color: C.gold, fontStyle: "italic" }}>→ {g.acao}</div>
                  </div>
                  {actionBar(
                    <button
                      onClick={() => showToast("Acionado — equipe notificada")}
                      style={{
                        flex: 1, padding: "5px 0", borderRadius: 6,
                        background: C.green, border: "none", color: "#fff",
                        fontSize: 10, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      Resolver
                    </button>
                  )}
                </div>
              ))}
              <div style={{ height: 10 }} />
            </div>
          )}

          {/* ALERTAS */}
          {tab === "alertas" && (
            <div>
              {alertsVisiveis.length === 0 && (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                  <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Sem alertas no momento</div>
                </div>
              )}
              {alertsVisiveis.map(a => {
                const dotColor = a.tipo === "critico" ? C.red : a.tipo === "atencao" ? C.gold : C.green;
                const bgColor  = a.tipo === "critico" ? C.redSoft : a.tipo === "atencao" ? "rgba(201,162,74,0.08)" : "rgba(22,163,74,0.07)";
                return (
                  <div key={a.id} style={{
                    margin: "10px 10px 0", background: bgColor, borderRadius: 10,
                    borderLeft: `3px solid ${dotColor}`, overflow: "hidden",
                  }}>
                    <div
                      onClick={() => a.link && router.push(a.link)}
                      style={{
                        padding: "10px 12px 8px",
                        display: "flex", alignItems: "flex-start", gap: 8,
                        cursor: a.link ? "pointer" : "default",
                      }}
                    >
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", background: dotColor,
                        flexShrink: 0, marginTop: 3,
                        ...(a.tipo === "critico" ? { animation: "pulse 1.4s ease-in-out infinite" } : {}),
                      }} />
                      <span style={{ fontSize: 11, color: C.text, lineHeight: 1.55, flex: 1 }}>{a.msg}</span>
                    </div>
                    {a.tipo === "atencao" && (
                      <div style={{ padding: "0 10px 8px" }}>
                        <button
                          onClick={() => setAlertIgn(p => ({ ...p, [a.id]: Date.now() + 4 * 60 * 60 * 1000 }))}
                          style={{
                            padding: "4px 10px", borderRadius: 6,
                            background: "transparent", border: `1px solid ${C.line}`,
                            color: C.muted, fontSize: 9.5, cursor: "pointer",
                          }}
                        >
                          Ignorar por 4h
                        </button>
                      </div>
                    )}
                    {a.tipo === "critico" && a.link && (
                      <div style={{ padding: "0 10px 8px" }}>
                        <button
                          onClick={() => router.push(a.link!)}
                          style={{
                            padding: "4px 10px", borderRadius: 6,
                            background: C.red, border: "none",
                            color: "#fff", fontSize: 9.5, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          Ver lead →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ height: 10 }} />
            </div>
          )}

        </div>
      </div>

      {/* ── Overlays (position: fixed, outside panel flow) ─── */}
      {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}
      {slideOver && (
        <AnaliseSlideOver
          item={slideOver}
          onClose={() => setSlideOver(null)}
          onAprovar={() => aprovar(slideOver.id)}
          onIgnorar={() => ignorar(slideOver.id)}
          loading={!!btnLoading[slideOver.id]}
        />
      )}
      {agendarModal && (
        <AgendarModal
          leadId={agendarModal.leadId}
          leadNome={agendarModal.leadNome}
          onClose={() => setAgendarModal(null)}
          onSaved={() => showToast("Agendamento salvo")}
        />
      )}
    </>
  );
}
