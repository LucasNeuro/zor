"use client";
import { useState, useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:       "#f7f4ec",
  green:    "#003b26",
  gold:     "#c9a24a",
  goldBg:   "rgba(201,162,74,0.09)",
  red:      "#b3261e",
  redSoft:  "rgba(179,38,30,0.09)",
  text:     "#1a1a1a",
  muted:    "#7a786c",
  line:     "#e0ddd6",
  white:    "#ffffff",
};

// ─── Types ────────────────────────────────────────────────────────────────────
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
  valor_envolvido?: number;
  status: string;
  criado_em: string;
}

const TIPO_ICON: Record<string, string> = {
  proposta: "📋", campanha: "📊", conteudo: "✏️", site: "🌐",
  ajuste_agente: "🤖", trafego: "📈", contrato: "📜",
  financeiro: "💰", atendimento_critico: "🚨", atendimento: "💬",
};

const TIPO_BORDER: Record<string, string> = {
  proposta: "#3b82f6", campanha: C.gold, conteudo: "#a855f7",
  site: "#06b6d4", ajuste_agente: "#8b5cf6", trafego: C.red,
  contrato: C.green, financeiro: "#16a34a", atendimento_critico: C.red,
  atendimento: C.gold,
};

function rel(d: string) {
  const m = (Date.now() - new Date(d).getTime()) / 60000;
  return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : `${Math.round(m / 60)}h`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo }: { msg: string; tipo: "ok" | "erro" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: tipo === "ok" ? C.green : C.red,
      color: "#fff", padding: "10px 18px", borderRadius: 10,
      fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,40,26,0.2)",
      animation: "fadeInUp 0.25s ease",
    }}>
      {tipo === "ok" ? "✓ " : "✕ "}{msg}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AprovacoesInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const tipoParam = searchParams.get("tipo") ?? "todos";

  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [filtro, setFiltro]         = useState(tipoParam);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);

  function showToast(msg: string, tipo: "ok" | "erro" = "ok") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    setFiltro(tipoParam);
  }, [tipoParam]);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("aprovacoes_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregar() {
    const { data } = await supabase
      .from("hub_aprovacoes")
      .select("*")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false });
    if (data) setAprovacoes(data as Aprovacao[]);
    setCarregando(false);
  }

  async function aprovar(id: string) {
    setProcessando(id);
    const res = await fetch(`/api/aprovacoes/${id}`, {
      method: "PATCH",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "aprovado", aprovado_por: "wendel" }),
    });
    if (res.ok) {
      setAprovacoes(prev => prev.filter(a => a.id !== id));
      showToast("Aprovado com sucesso");
    } else {
      showToast("Erro ao aprovar", "erro");
    }
    setProcessando(null);
  }

  async function rejeitar(id: string) {
    setProcessando(id);
    const res = await fetch(`/api/aprovacoes/${id}`, {
      method: "PATCH",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejeitado", aprovado_por: "wendel" }),
    });
    if (res.ok) {
      setAprovacoes(prev => prev.filter(a => a.id !== id));
      showToast("Reprovado");
    } else {
      showToast("Erro", "erro");
    }
    setProcessando(null);
  }

  const tipos = ["todos", ...Array.from(new Set(aprovacoes.map(a => a.tipo)))];
  const filtradas = filtro === "todos" ? aprovacoes : aprovacoes.filter(a => a.tipo === filtro);

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${aprovacoes.length} pendente${aprovacoes.length !== 1 ? "s" : ""} — tudo que precisa da sua decisão`,
      actions:
        aprovacoes.length > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: C.redSoft,
              border: `1px solid ${C.red}44`,
              borderRadius: 20,
              padding: "4px 12px",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.red,
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
            <span style={{ color: C.red, fontSize: 11, fontWeight: 700 }}>{aprovacoes.length} aguardando</span>
          </div>
        ) : undefined,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, aprovacoes.length]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {/* ── Filters ─── */}
      <div style={{
        display: "flex", gap: 8, padding: "12px 24px",
        background: C.white, borderBottom: `1px solid ${C.line}`,
        overflowX: "auto", flexShrink: 0,
      }}>
        {tipos.map(t => {
          const active = filtro === t;
          const count = t === "todos" ? aprovacoes.length : aprovacoes.filter(a => a.tipo === t).length;
          return (
            <button key={t} onClick={() => setFiltro(t)} style={{
              padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap", cursor: "pointer",
              background: active ? C.green : C.bg,
              border: `1px solid ${active ? C.green : C.line}`,
              color: active ? "#fff" : C.muted,
              fontSize: 12, fontWeight: active ? 700 : 500,
              transition: "all 150ms", flexShrink: 0,
            }}>
              {t === "todos" ? `Todos (${count})` : `${TIPO_ICON[t] || "•"} ${t} (${count})`}
            </button>
          );
        })}
      </div>

      {/* ── Content ─── */}
      <div style={{ flex: 1, padding: "24px" }}>
        {carregando ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: C.muted, fontSize: 14 }}>Carregando aprovações...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ color: C.green, fontWeight: 700, fontSize: 16, margin: 0 }}>Nenhuma aprovação pendente</p>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>O sistema está operando normalmente</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {filtradas.map(ap => {
              const borderCol = TIPO_BORDER[ap.tipo] ?? C.gold;
              const isProcessing = processando === ap.id;
              return (
                <div key={ap.id} style={{
                  background: C.white,
                  borderRadius: 14,
                  borderTop: `3px solid ${borderCol}`,
                  boxShadow: "0 2px 12px rgba(0,40,26,0.07)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{TIPO_ICON[ap.tipo] || "📌"}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: C.green, fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.3 }}>{ap.descricao}</p>
                      <p style={{ color: C.muted, fontSize: 11, margin: "4px 0 0" }}>
                        {ap.agente_nome || ap.agente_slug} · {rel(ap.criado_em)}
                      </p>
                    </div>
                  </div>

                  {/* Motivo */}
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>O que observou:</p>
                    <p style={{ color: C.text, fontSize: 12, margin: 0, lineHeight: 1.6 }}>{ap.motivo}</p>
                  </div>

                  {/* Impacto */}
                  {ap.impacto && (
                    <div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Impacto:</p>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                        background: ap.impacto === "alto" || ap.impacto === "critico" ? C.redSoft : C.goldBg,
                        color: ap.impacto === "alto" || ap.impacto === "critico" ? C.red : C.gold,
                      }}>
                        {ap.impacto.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Recomendação */}
                  {ap.recomendacao && (
                    <div style={{ background: C.goldBg, borderRadius: 8, padding: "10px 12px", borderLeft: `2px solid ${C.gold}` }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Recomendação da IA:</p>
                      <p style={{ color: C.text, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{ap.recomendacao}</p>
                    </div>
                  )}

                  {/* Valor + confiança */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {ap.valor_envolvido && ap.valor_envolvido > 0 ? (
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>
                        R$ {ap.valor_envolvido.toLocaleString("pt-BR")}
                      </span>
                    ) : <span />}
                    {ap.confianca_ia && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60, height: 5, background: C.line, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${ap.confianca_ia}%`, background: C.gold, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.gold }}>IA {ap.confianca_ia}%</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button
                      onClick={() => aprovar(ap.id)}
                      disabled={isProcessing}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 8,
                        background: isProcessing ? C.line : C.green,
                        border: "none", color: isProcessing ? C.muted : "#fff",
                        fontSize: 12, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
                        transition: "opacity 150ms",
                      }}
                      onMouseOver={e => !isProcessing && (e.currentTarget.style.opacity = "0.85")}
                      onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                    >
                      {isProcessing ? "..." : "✓ Aprovar"}
                    </button>
                    <button
                      onClick={() => rejeitar(ap.id)}
                      disabled={isProcessing}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 8,
                        background: "transparent",
                        border: `1px solid ${isProcessing ? C.line : C.red + "66"}`,
                        color: isProcessing ? C.muted : C.red,
                        fontSize: 12, fontWeight: 600, cursor: isProcessing ? "not-allowed" : "pointer",
                        transition: "border-color 150ms",
                      }}
                      onMouseOver={e => !isProcessing && (e.currentTarget.style.borderColor = C.red)}
                      onMouseOut={e => !isProcessing && (e.currentTarget.style.borderColor = C.red + "66")}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}
    </div>
  );
}

export default function AprovacoesPage() {
  return (
    <Suspense fallback={<div style={{ background: "#f7f4ec", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7a786c" }}>Carregando...</div>}>
      <AprovacoesInner />
    </Suspense>
  );
}
