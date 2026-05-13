"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageSquarePlus, Send, User, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Sessao = { id: string; titulo: string | null; criado_em: string; atualizado_em: string };
type Msg = {
  id: string;
  papel: string;
  conteudo: string;
  criado_em: string;
  metadata?: Record<string, unknown>;
};

export type AgenteBriefingDrawerProps = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
};

export function AgenteBriefingDrawer({ open, onClose, agenteSlug, agenteNome }: AgenteBriefingDrawerProps) {
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/briefing-chat`;

  const carregar = useCallback(
    async (overrideSessao?: string | null) => {
      if (!agenteSlug) return;
      const sid = overrideSessao !== undefined ? overrideSessao : sessaoId;
      setCarregando(true);
      setErro("");
      try {
        const q = sid ? `?sessao_id=${encodeURIComponent(sid)}` : "";
        const res = await fetch(`${base}${q}`, { headers: internalApiHeaders() });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          sessoes?: Sessao[];
          mensagens?: Msg[];
        };
        if (!res.ok) {
          setErro(typeof data?.error === "string" ? data.error : `Erro ${res.status}`);
          return;
        }
        setSessoes(Array.isArray(data.sessoes) ? data.sessoes : []);
        setMensagens(Array.isArray(data.mensagens) ? data.mensagens : []);
      } catch {
        setErro("Falha de rede ao carregar briefing.");
      } finally {
        setCarregando(false);
      }
    },
    [agenteSlug, base, sessaoId]
  );

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !agenteSlug) return;
    void carregar();
  }, [open, agenteSlug, carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando, open]);

  async function enviar() {
    const t = input.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    setInput("");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ sessao_id: sessaoId, mensagem: t }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessao_id?: string;
        mensagens?: Msg[];
      };
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro ${res.status}`);
        setInput(t);
        return;
      }
      if (data.sessao_id) setSessaoId(data.sessao_id);
      if (Array.isArray(data.mensagens)) setMensagens(data.mensagens);
      void carregar(data.sessao_id ?? sessaoId);
    } catch {
      setErro("Falha de rede ao enviar.");
      setInput(t);
    } finally {
      setEnviando(false);
    }
  }

  function novaSessao() {
    setSessaoId(null);
    setMensagens([]);
    setErro("");
    void carregar(null);
  }

  function selecionarSessao(id: string) {
    setSessaoId(id);
    void carregar(id);
  }

  if (!agenteSlug) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 201,
          height: "100vh",
          width: "min(100vw, 720px)",
          maxWidth: "100%",
          background: "#0d1117",
          borderLeft: "1px solid #30363d",
          boxShadow: open ? "-12px 0 40px rgba(0,0,0,0.45)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Barra superior */}
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "linear-gradient(180deg, #161b22 0%, #0d1117 100%)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ color: "#e6edf3", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
              Briefing interno
            </h2>
            <p style={{ color: "#8b949e", fontSize: 11, margin: 0, lineHeight: 1.45 }}>
              {agenteNome} · dados reais do hub (leitura). Sem WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid #30363d",
              background: "#21262d",
              color: "#c9d1d9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo: histórico + chat */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Coluna histórico */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: "1px solid #30363d",
              display: "flex",
              flexDirection: "column",
              background: "#0d1117",
            }}
          >
            <div style={{ padding: 12, borderBottom: "1px solid #21262d" }}>
              <button
                type="button"
                onClick={novaSessao}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #c9a24a55",
                  background: "#c9a24a18",
                  color: "#d6b976",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <MessageSquarePlus size={18} /> Nova conversa
              </button>
            </div>
            <p
              style={{
                margin: 0,
                padding: "8px 12px",
                fontSize: 10,
                fontWeight: 800,
                color: "#6e7681",
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              Histórico
            </p>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
              {sessoes.length === 0 && !carregando && (
                <p style={{ color: "#6e7681", fontSize: 11, padding: "0 6px", lineHeight: 1.4 }}>
                  Nenhuma sessão ainda. Use “Nova conversa” ou envie a primeira mensagem.
                </p>
              )}
              {sessoes.map((s) => {
                const ativo = sessaoId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selecionarSessao(s.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 10px",
                      marginBottom: 6,
                      borderRadius: 10,
                      border: `1px solid ${ativo ? "#c9a24a66" : "#30363d"}`,
                      background: ativo ? "#c9a24a14" : "#161b22",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#e6edf3",
                        marginBottom: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.titulo?.trim() || `Briefing ${s.id.slice(0, 6)}…`}
                    </div>
                    <div style={{ fontSize: 10, color: "#8b949e" }}>
                      {new Date(s.atualizado_em).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área mensagens */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0d1117" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 20px" }}>
              {carregando && (
                <p style={{ color: "#8b949e", fontSize: 12 }}>Carregando…</p>
              )}
              {erro && (
                <div
                  style={{
                    background: "#3d1414",
                    border: "1px solid #f8514966",
                    borderRadius: 10,
                    padding: 12,
                    color: "#f85149",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {erro}
                </div>
              )}
              {!carregando && !sessaoId && mensagens.length === 0 && !erro && (
                <p style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.55, maxWidth: 420 }}>
                  Escolha uma conversa no painel à esquerda ou inicie uma nova. O agente responde com um relatório
                  baseado em ciclos, logs e ações — snapshot atualizado a cada pergunta.
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {mensagens.map((m) => {
                  const isUser = m.papel === "user";
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "flex-start",
                        justifyContent: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isUser && (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "linear-gradient(145deg, #003b26, #14532d)",
                            border: "1px solid #22c55e55",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Bot size={20} color="#86efac" strokeWidth={2} aria-hidden />
                        </div>
                      )}
                      <div
                        style={{
                          maxWidth: "min(92%, 520px)",
                          order: isUser ? 1 : 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                            flexDirection: isUser ? "row-reverse" : "row",
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: isUser ? "#79c0ff" : "#86efac" }}>
                            {isUser ? "Você" : agenteNome}
                          </span>
                          <span style={{ fontSize: 10, color: "#6e7681" }}>
                            {new Date(m.criado_em).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <div
                          style={{
                            background: isUser ? "#1c2a3a" : "#161b22",
                            border: `1px solid ${isUser ? "#388bfd44" : "#30363d"}`,
                            borderRadius: isUser ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
                            padding: "12px 14px",
                            fontSize: 13,
                            color: "#e6edf3",
                            lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {m.conteudo}
                        </div>
                        {!isUser && m.metadata && typeof m.metadata === "object" && m.metadata.modelo ? (
                          <div style={{ fontSize: 10, color: "#484f58", marginTop: 6, paddingLeft: 2 }}>
                            {String(m.metadata.modelo)} · {String(m.metadata.tokens_input ?? "—")}/
                            {String(m.metadata.tokens_output ?? "—")} tok · ~ R$ {Number(m.metadata.custo_brl ?? 0).toFixed(4)}
                          </div>
                        ) : null}
                      </div>
                      {isUser && (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "#1c2a3a",
                            border: "1px solid #388bfd55",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <User size={18} color="#79c0ff" strokeWidth={2} aria-hidden />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div ref={fimRef} />
            </div>

            {/* Composer */}
            <div
              style={{
                flexShrink: 0,
                padding: "12px 16px 16px",
                borderTop: "1px solid #30363d",
                background: "#161b22",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 10,
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: 14,
                  padding: "8px 10px 8px 14px",
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Peça um resumo operacional…"
                  rows={2}
                  disabled={enviando}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 120,
                    resize: "none",
                    border: "none",
                    background: "transparent",
                    color: "#e6edf3",
                    fontSize: 13,
                    lineHeight: 1.45,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={enviando || !input.trim()}
                  onClick={() => void enviar()}
                  aria-label="Enviar"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "none",
                    background:
                      enviando || !input.trim() ? "#30363d" : "linear-gradient(145deg, #003b26, #14532d)",
                    color: "#c9a24a",
                    cursor: enviando || !input.trim() ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Send size={20} />
                </button>
              </div>
              <p style={{ fontSize: 10, color: "#484f58", margin: "8px 0 0", textAlign: "center" }}>
                Enter envia · Shift+Enter nova linha
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
