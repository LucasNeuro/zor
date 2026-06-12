"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { mensagemErroBriefingChat } from "@/lib/hub/briefing-chat-errors";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Msg = {
  id: string;
  papel: string;
  conteudo: string;
  criado_em: string;
  metadata?: Record<string, unknown>;
};

const OPTIMISTIC_USER_PREFIX = "optimistic-user-";

function isOptimisticUserMessage(m: Msg): boolean {
  return m.papel === "user" && m.id.startsWith(OPTIMISTIC_USER_PREFIX);
}

export type ModoBriefingChat = "briefing_interno" | "simulacao_canal";

export type AgenteBriefingDrawerProps = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
};

export function AgenteBriefingDrawer({ open, onClose, agenteSlug, agenteNome }: AgenteBriefingDrawerProps) {
  const [modoChat, setModoChat] = useState<ModoBriefingChat>("briefing_interno");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/briefing-chat`;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /** Conversa única por abertura do painel — foco em testar playbook / prompt sem lista de sessões. */
  useEffect(() => {
    if (!open || !agenteSlug) return;
    setSessaoId(null);
    setMensagens([]);
    setErro("");
    setInput("");
  }, [open, agenteSlug, modoChat]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando, open]);

  async function enviar() {
    const t = input.trim();
    if (!t || enviando) return;
    const tempId = `${OPTIMISTIC_USER_PREFIX}${Date.now()}`;
    const now = new Date().toISOString();
    setMensagens((prev) => [...prev, { id: tempId, papel: "user", conteudo: t, criado_em: now }]);
    setEnviando(true);
    setErro("");
    setInput("");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ sessao_id: sessaoId, mensagem: t, modo: modoChat }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessao_id?: string;
        mensagens?: Msg[];
      };
      if (!res.ok) {
        setMensagens((prev) => prev.filter((m) => m.id !== tempId));
        setErro(
          mensagemErroBriefingChat(
            typeof data?.error === "string" ? data.error : `Erro ${res.status}`
          )
        );
        setInput(t);
        if (res.status === 409) setSessaoId(null);
        return;
      }
      if (data.sessao_id) setSessaoId(data.sessao_id);
      if (Array.isArray(data.mensagens)) setMensagens(data.mensagens);
    } catch {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      setErro("Falha de rede ao enviar.");
      setInput(t);
    } finally {
      setEnviando(false);
    }
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
          width: "min(100vw, 820px)",
          maxWidth: "100%",
          background: "#060d08",
          borderLeft: "1px solid rgba(63, 152, 72, 0.42)",
          boxShadow: open ? "-12px 0 40px rgba(0,0,0,0.45)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(146, 255, 0, 0.16)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            background: "#0b1f10",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ color: RF_TEXT_PRIMARY, fontSize: 15, fontWeight: 700, margin: 0 }}>Copiloto IA</h2>
            <p
              style={{
                color: RF_TEXT_MUTED,
                fontSize: 12,
                fontWeight: 600,
                margin: "4px 0 0",
                lineHeight: 1.35,
              }}
            >
              {agenteNome}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
              role="group"
              aria-label="Modo de teste do funcionário IA"
            >
              <button
                type="button"
                onClick={() => setModoChat("briefing_interno")}
                disabled={enviando}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${modoChat === "briefing_interno" ? RF_BORDER_STRONG : RF_BORDER}`,
                  background: modoChat === "briefing_interno" ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.72)",
                  color: modoChat === "briefing_interno" ? RF_ACCENT : RF_TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                Revisão operacional
              </button>
              <button
                type="button"
                onClick={() => setModoChat("simulacao_canal")}
                disabled={enviando}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${modoChat === "simulacao_canal" ? RF_BORDER_STRONG : RF_BORDER}`,
                  background: modoChat === "simulacao_canal" ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.72)",
                  color: modoChat === "simulacao_canal" ? RF_ACCENT : RF_TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                Simulação interna
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#6e7681", margin: "8px 0 0", lineHeight: 1.45 }}>
              {modoChat === "briefing_interno"
                ? "Visão de operação: ciclos, logs e acções reais do agente. Sem ferramentas — isso só na conversa ao vivo com o cliente."
                : "Mesmo fluxo determinístico do WhatsApp (playbook publicado + cargo + conhecimento). Sem UAZAPI nem CRM real — responda como o cliente (número ou texto no menu)."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={rfCloseButtonStyle()}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: "#060d08" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 20px" }}>
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
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {erro}
              </div>
            )}
            {mensagens.length === 0 && !erro && !enviando && (
              <p style={{ color: RF_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
                {modoChat === "briefing_interno" ? (
                  <>
                    Envie uma mensagem: o agente interpreta{" "}
                    <strong style={{ color: "#aebccf" }}>ciclos, logs e ações</strong> já registados. Estas respostas
                    <strong style={{ color: "#aebccf" }}> não usam</strong> ferramentas automáticas — essas só na conversa
                    ao vivo com o cliente no WhatsApp.
                  </>
                ) : (
                  <>
                    Simule o <strong style={{ color: "#aebccf" }}>mesmo fluxo do WhatsApp</strong> (saudação, menus e perguntas do playbook). Publique o playbook com fluxo válido antes. Sem envio real nem gravação no CRM.
                  </>
                )}
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
                        maxWidth: "min(94%, 680px)",
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
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isUser ? "#79c0ff" : "#86efac",
                          }}
                        >
                          {isUser ? (
                            "Você"
                          ) : (
                            <>
                              Funcionário IA{" "}
                              <span style={{ fontWeight: 600, color: "#7f90a8" }}>· {agenteNome}</span>
                            </>
                          )}
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
                          background: isUser ? "rgba(11, 31, 16, 0.95)" : "rgba(6, 13, 8, 0.85)",
                          border: `1px solid ${isUser ? RF_BORDER_STRONG : RF_BORDER}`,
                          borderRadius: isUser ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
                          padding: "12px 14px",
                          fontSize: 13,
                          color: RF_TEXT_PRIMARY,
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          ...(isOptimisticUserMessage(m) ? { animation: "bubbleIn 0.28s ease-out" } : {}),
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
              {enviando && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                  }}
                >
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
                  <div style={{ maxWidth: "min(94%, 680px)" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#86efac" }}>
                        Funcionário IA <span style={{ fontWeight: 600, color: "#7f90a8" }}>· {agenteNome}</span>
                      </span>
                      <span style={{ fontSize: 10, color: "#6e7681" }}>a gerar resposta…</span>
                    </div>
                    <div
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                      style={{
                        background: "rgba(6, 13, 8, 0.85)",
                        border: `1px solid ${RF_BORDER}`,
                        borderRadius: "16px 16px 16px 6px",
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        animation: "bubbleIn 0.25s ease-out",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#7f90a8",
                              animation: `dotBlink ${0.55 + i * 0.12}s ease-in-out infinite`,
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: "#5d7a67" }}>Funcionário IA a responder…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={fimRef} />
          </div>

          <div
            style={{
              flexShrink: 0,
              padding: "12px 16px 16px",
              borderTop: `1px solid ${RF_BORDER}`,
              background: "#0b1f10",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                background: "rgba(6, 13, 8, 0.85)",
                border: `1px solid ${RF_BORDER_STRONG}`,
                borderRadius: 14,
                padding: "8px 10px 8px 14px",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Mensagem para o funcionário IA (revisão ou simulação interna)…"
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
                  color: RF_TEXT_PRIMARY,
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
                    enviando || !input.trim() ? "#dcebd8" : "linear-gradient(145deg, #003b26, #14532d)",
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
              Enter envia · Shift+Enter nova linha · ao fechar e reabrir, conversa nova com este funcionário IA
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
