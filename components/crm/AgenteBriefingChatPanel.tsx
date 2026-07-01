"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, User, X } from "lucide-react";
import { CopilotoMultimodalComposer } from "@/components/crm/CopilotoMultimodalComposer";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { hubQueryKeys } from "@/lib/hub/hub-query-keys";
import { mensagemErroBriefingChat } from "@/lib/hub/briefing-chat-errors";
import {
  agenteEhCopilotoInterno,
  isModoOperacaoAgente,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import { agenteEhPerfilAnalistaCrm } from "@/lib/hub/copiloto-interno-escopo";
import {
  extrairIdArtefatoDaUrl,
  isUrlArtefatoApp,
  pathArtefatoRelativo,
} from "@/lib/hub/superagente/artefato-public-url";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  HARNESS_DISPLAY_INITIAL,
  harnessDisplayReducer,
  pendingToHarnessEvents,
} from "@/lib/harness/display-state";

type Msg = {
  id: string;
  papel: string;
  conteudo: string;
  criado_em: string;
  metadata?: Record<string, unknown>;
};

function anexosDaMensagem(metadata?: Record<string, unknown>): Array<{
  nome: string;
  tipo?: string;
  resumo?: string;
}> {
  if (!metadata || !Array.isArray(metadata.anexos)) return [];
  return (metadata.anexos as Record<string, unknown>[])
    .map((a) => ({
      nome: String(a.nome ?? "anexo"),
      tipo: typeof a.tipo === "string" ? a.tipo : undefined,
      resumo: typeof a.resumo === "string" ? a.resumo : undefined,
    }))
    .filter((a) => a.nome);
}

const OPTIMISTIC_USER_PREFIX = "optimistic-user-";

const HARNESS_MODOS = [
  { id: "conversar" as const, label: "Conversar" },
  { id: "analisar" as const, label: "Analisar" },
  { id: "operar" as const, label: "Operar" },
  { id: "planear" as const, label: "Planear" },
];

type HarnessPendingApproval = {
  id: string;
  tool_name: string;
  resumo_humano: string;
  nivel?: string;
};

type HarnessModoId = (typeof HARNESS_MODOS)[number]["id"];

function isOptimisticUserMessage(m: Msg): boolean {
  return m.papel === "user" && m.id.startsWith(OPTIMISTIC_USER_PREFIX);
}

export type ModoBriefingChat = "briefing_interno" | "simulacao_canal";

export type AgenteBriefingDrawerProps = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
  agenteCargo?: string | null;
  modoOperacao?: ModoOperacaoAgente | string | null;
};

export function AgenteBriefingDrawer({
  open,
  onClose,
  agenteSlug,
  agenteNome,
  agenteCargo = null,
  modoOperacao = null,
}: AgenteBriefingDrawerProps) {
  const queryClient = useQueryClient();
  const modoResolvido = isModoOperacaoAgente(modoOperacao) ? modoOperacao : null;
  const ehCopilotoInterno = agenteEhCopilotoInterno(modoResolvido);
  const ehAnalistaCrm = agenteEhPerfilAnalistaCrm({ cargo: agenteCargo });
  const [modoChat, setModoChat] = useState<ModoBriefingChat>("briefing_interno");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [harnessModo, setHarnessModo] = useState<HarnessModoId>("analisar");
  const [escritaPendente, setEscritaPendente] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<HarnessPendingApproval[]>([]);
  const [displayState, dispatchHarness] = useReducer(harnessDisplayReducer, HARNESS_DISPLAY_INITIAL);
  const fimRef = useRef<HTMLDivElement>(null);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/briefing-chat`;

  useEffect(() => {
    if (!open || !agenteSlug || !ehCopilotoInterno) return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/harness/session`,
          { headers: await hubApiHeaders() }
        );
        const data = (await res.json().catch(() => ({}))) as {
          modo_id?: HarnessModoId;
          pending_approvals?: HarnessPendingApproval[];
        };
        if (data.modo_id && HARNESS_MODOS.some((m) => m.id === data.modo_id)) {
          setHarnessModo(data.modo_id!);
        }
        if (Array.isArray(data.pending_approvals)) {
          setPendingApprovals(data.pending_approvals);
          setEscritaPendente(data.pending_approvals.length > 0);
          for (const ev of pendingToHarnessEvents(data.pending_approvals)) {
            dispatchHarness(ev);
          }
        }
        dispatchHarness({ type: "mode_changed", modoId: data.modo_id ?? "analisar" });
      } catch {
        /* opcional */
      }
    })();
  }, [open, agenteSlug, ehCopilotoInterno]);

  async function mudarHarnessModo(modo: HarnessModoId) {
    setHarnessModo(modo);
    dispatchHarness({ type: "mode_changed", modoId: modo });
    try {
      await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/harness/session`, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ modo_id: modo }),
      });
    } catch {
      /* UI já reflecte modo local */
    }
  }

  async function aprovarEscritaHarness() {
    try {
      await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/harness/session`, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ aprovar_escrita_sessao: true }),
      });
      setEscritaPendente(false);
    } catch {
      setErro("Não foi possível aprovar escrita CRM nesta sessão.");
    }
  }

  async function decidirAprovacao(approvalId: string, decisao: "aprovar" | "rejeitar") {
    setEnviando(true);
    setErro("");
    try {
      const historico = mensagens
        .filter((m) => m.papel === "user" || m.papel === "assistant")
        .map((m) => ({
          role: m.papel,
          content: m.conteudo,
        }));
      const res = await fetch(base, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          sessao_id: sessaoId,
          mensagem: "",
          modo: "briefing_interno",
          approval_id: approvalId,
          approval_decisao: decisao,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessao_id?: string;
        mensagens?: Msg[];
        ultima_resposta_meta?: {
          pending_approvals?: HarnessPendingApproval[];
          tokens_input?: number;
          tokens_output?: number;
        };
      };
      if (!res.ok) {
        setErro(
          mensagemErroBriefingChat(
            typeof data?.error === "string" ? data.error : `Erro ${res.status}`
          )
        );
        return;
      }
      if (data.sessao_id) setSessaoId(data.sessao_id);
      if (Array.isArray(data.mensagens)) setMensagens(data.mensagens);
      const pending = data.ultima_resposta_meta?.pending_approvals ?? [];
      setPendingApprovals(pending);
      setEscritaPendente(pending.length > 0);
    } catch {
      setErro("Falha ao processar aprovação.");
    } finally {
      setEnviando(false);
    }
  }

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
    setModoChat("briefing_interno");
    setSessaoId(null);
    setMensagens([]);
    setErro("");
    setInput("");
  }, [open, agenteSlug, modoOperacao]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando, open]);

  async function enviar(payload?: { texto: string; anexos: Array<{ nome: string; mime: string; base64: string }> }) {
    const t = (payload?.texto ?? input).trim();
    const anexos = payload?.anexos ?? [];
    if ((!t && anexos.length === 0) || enviando) return;
    const preview =
      t ||
      (anexos.length === 1 ? `[Anexo: ${anexos[0].nome}]` : `[${anexos.length} anexos]`);
    const tempId = `${OPTIMISTIC_USER_PREFIX}${Date.now()}`;
    const now = new Date().toISOString();
    setMensagens((prev) => [
      ...prev,
      {
        id: tempId,
        papel: "user",
        conteudo: preview,
        criado_em: now,
        metadata: anexos.length
          ? {
              multimodal: true,
              anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.mime.split("/")[0] })),
            }
          : undefined,
      },
    ]);
    setEnviando(true);
    setErro("");
    dispatchHarness({ type: "turn_start", modoId: harnessModo });
    setInput("");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          sessao_id: sessaoId,
          mensagem: t,
          modo: ehCopilotoInterno ? "briefing_interno" : modoChat,
          ...(anexos.length ? { anexos } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessao_id?: string;
        mensagens?: Msg[];
        ultima_resposta_meta?: {
          pending_approvals?: HarnessPendingApproval[];
          tokens_input?: number;
          tokens_output?: number;
        };
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
      if (Array.isArray(data.mensagens)) {
        setMensagens(data.mensagens);
        const pending = data.ultima_resposta_meta?.pending_approvals ?? [];
        setPendingApprovals(pending);
        setEscritaPendente(
          pending.length > 0 ||
            Boolean(
              data.mensagens
                .filter((m) => m.papel === "assistant")
                .pop()
                ?.conteudo?.includes("requer_aprovacao")
            )
        );
        for (const ev of pendingToHarnessEvents(pending)) {
          dispatchHarness(ev);
        }
        const meta = data.ultima_resposta_meta;
        dispatchHarness({
          type: "turn_end",
          tokensInput: meta?.tokens_input,
          tokensOutput: meta?.tokens_output,
        });
      }
      void queryClient.invalidateQueries({ queryKey: hubQueryKeys.agentes.operacao(agenteSlug) });
    } catch {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      setErro("Falha de rede ao enviar.");
      dispatchHarness({ type: "error", message: "Falha de rede ao enviar." });
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
              {ehCopilotoInterno ? (
                <span style={{ color: RF_TEXT_SECONDARY, fontWeight: 500 }}> · Agente interno</span>
              ) : null}
            </p>
            {!ehCopilotoInterno ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10,
                }}
                role="group"
                aria-label="Modo de teste do assistente"
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
            ) : null}
            {ehCopilotoInterno ? (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
                role="group"
                aria-label="Modo harness"
              >
                {HARNESS_MODOS.map((m) => {
                  const at = harnessModo === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={enviando}
                      onClick={() => void mudarHarnessModo(m.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1px solid ${at ? RF_BORDER_STRONG : RF_BORDER}`,
                        background: at ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.72)",
                        color: at ? RF_ACCENT : RF_TEXT_MUTED,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: enviando ? "not-allowed" : "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <p style={{ fontSize: 10, color: "#6e7681", margin: "8px 0 0", lineHeight: 1.45 }}>
              {ehCopilotoInterno
                ? ehAnalistaCrm
                  ? "Analista de CRM: organiza e analisa leads no sistema. Não encaminha a parceiros — pergunte sobre status, ciclos e registos."
                  : "Converse com o copiloto: função do agente, leads, ciclos e registos. Modos harness governam escrita CRM. Memórias persistem por assistente."
                : modoChat === "briefing_interno"
                  ? "Consulte o histórico de operação deste assistente. Ações automáticas só funcionam na conversa real com o cliente."
                  : "Espelha o WhatsApp real: conhecimento, RAG e ferramentas — sem criar leads no funil nem enviar mensagens reais."}
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
            {ehCopilotoInterno && (displayState.tokenUsage.input > 0 || displayState.isStreaming) ? (
              <p style={{ fontSize: 10, color: RF_TEXT_MUTED, margin: "0 0 10px" }}>
                Harness · modo {displayState.modeId}
                {displayState.isStreaming ? " · a pensar…" : ""}
                {displayState.tokenUsage.input > 0
                  ? ` · tokens ${displayState.tokenUsage.input}/${displayState.tokenUsage.output}`
                  : ""}
              </p>
            ) : null}
            {pendingApprovals.length > 0 && ehCopilotoInterno ? (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingApprovals.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "rgba(248,187,92,0.12)",
                      border: "1px solid rgba(248,187,92,0.4)",
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 12,
                      color: RF_TEXT_SECONDARY,
                    }}
                  >
                    <strong style={{ color: RF_ACCENT }}>Aprovação pendente:</strong>{" "}
                    {p.resumo_humano || p.tool_name}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => void decidirAprovacao(p.id, "aprovar")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: `1px solid ${RF_BORDER_STRONG}`,
                          background: "rgba(146,255,0,0.12)",
                          color: RF_ACCENT,
                          fontWeight: 700,
                          cursor: enviando ? "not-allowed" : "pointer",
                        }}
                      >
                        Aprovar uma vez
                      </button>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => void decidirAprovacao(p.id, "rejeitar")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: `1px solid ${RF_BORDER}`,
                          background: "transparent",
                          color: RF_TEXT_MUTED,
                          fontWeight: 600,
                          cursor: enviando ? "not-allowed" : "pointer",
                        }}
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {escritaPendente && ehCopilotoInterno && pendingApprovals.length === 0 ? (
              <div
                style={{
                  background: "rgba(248,187,92,0.12)",
                  border: "1px solid rgba(248,187,92,0.4)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  fontSize: 12,
                  color: RF_TEXT_SECONDARY,
                }}
              >
                <strong style={{ color: RF_ACCENT }}>Aprovação CRM:</strong> o agente precisa de autorização
                para gravar.{" "}
                <button
                  type="button"
                  onClick={() => void aprovarEscritaHarness()}
                  style={{
                    marginLeft: 6,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px solid ${RF_BORDER_STRONG}`,
                    background: "rgba(146,255,0,0.12)",
                    color: RF_ACCENT,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Aprovar escrita nesta sessão
                </button>
              </div>
            ) : null}
            {mensagens.length === 0 && !erro && !enviando && (
              <p style={{ color: RF_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
                {ehCopilotoInterno ? (
                  ehAnalistaCrm ? (
                    <>
                      Olá! Sou o copiloto de <strong style={{ color: RF_TEXT_PRIMARY }}>{agenteNome}</strong>,
                      analista de CRM. Ajudo a equipa a entender leads, ciclos e registos no sistema — sem
                      encaminhar a ninguém e sem atender cliente no WhatsApp.
                    </>
                  ) : (
                    <>
                      Olá! Sou o copiloto de <strong style={{ color: RF_TEXT_PRIMARY }}>{agenteNome}</strong>. Pergunte o
                      que este assistente faz, peça resumos de leads, ciclos ou sugestões de próximo passo. Cada agente
                      guarda as próprias memórias — nada se mistura com outros assistentes.
                    </>
                  )
                ) : modoChat === "briefing_interno" ? (
                  <>
                    Pergunte sobre o que o assistente já fez — atividades, mensagens e registos guardados. Aqui não
                    executa ações automáticas; isso só acontece na conversa real com o cliente no WhatsApp.
                  </>
                ) : (
                  <>
                    Escreva como se fosse um cliente no WhatsApp. O assistente responde com o tom e conhecimento
                    configurados. Feche e reabra este painel para começar outra conversa.
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
                        {isUser && anexosDaMensagem(m.metadata).length > 0 ? (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                            {anexosDaMensagem(m.metadata).map((an) => (
                              <div
                                key={an.nome}
                                style={{
                                  fontSize: 11,
                                  color: RF_TEXT_SECONDARY,
                                  borderTop: `1px solid ${RF_BORDER}`,
                                  paddingTop: 8,
                                }}
                              >
                                <span style={{ fontWeight: 700, color: "#79c0ff" }}>
                                  {an.tipo === "audio" ? "Áudio" : an.tipo === "imagem" ? "Imagem" : "Anexo"}:{" "}
                                  {an.nome}
                                </span>
                                {an.resumo ? (
                                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: RF_TEXT_MUTED }}>
                                    {an.resumo.slice(0, 280)}
                                    {an.resumo.length > 280 ? "…" : ""}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {!isUser &&
                      m.metadata &&
                      typeof m.metadata === "object" &&
                      (m.metadata.tipo === "artefato_link" ||
                        m.metadata.tipo === "artefato_canvas" ||
                        (Array.isArray(m.metadata.urls_publicas) &&
                          (m.metadata.urls_publicas as string[]).length > 0)) ? (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                          {(
                            (Array.isArray(m.metadata.urls)
                              ? (m.metadata.urls as string[])
                              : Array.isArray(m.metadata.urls_publicas)
                                ? (m.metadata.urls_publicas as string[])
                                : []) as string[]
                          ).map((url) => {
                            const artefatoId = extrairIdArtefatoDaUrl(url);
                            const href =
                              artefatoId && typeof window !== "undefined"
                                ? `${window.location.origin}${pathArtefatoRelativo(artefatoId)}`
                                : url;
                            const iframeSrc = artefatoId ? pathArtefatoRelativo(artefatoId) : null;
                            return (
                            <div key={url} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: RF_ACCENT,
                                  wordBreak: "break-all",
                                }}
                              >
                                Abrir relatório / canvas →
                              </a>
                              {iframeSrc && isUrlArtefatoApp(url) ? (
                                <iframe
                                  src={iframeSrc}
                                  title="Relatório gerado pelo superagente"
                                  sandbox="allow-scripts allow-same-origin"
                                  style={{
                                    width: "100%",
                                    minHeight: 360,
                                    maxHeight: 520,
                                    border: `1px solid ${RF_BORDER}`,
                                    borderRadius: 12,
                                    background: "#0d1117",
                                  }}
                                />
                              ) : null}
                            </div>
                            );
                          })}
                        </div>
                      ) : null}
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
            <CopilotoMultimodalComposer
              value={input}
              onChange={setInput}
              onSend={(p) => enviar(p)}
              disabled={enviando}
              sending={enviando}
              multimodalAtivo
              mostrarDicas={!ehCopilotoInterno}
              placeholder={
                ehCopilotoInterno
                  ? "Pergunte ao copiloto ou anexe imagem, áudio ou documento para testar multimodal…"
                  : "Escreva sua mensagem ou anexe ficheiros para testar…"
              }
            />
            {!ehCopilotoInterno ? (
              <p style={{ fontSize: 10, color: "#484f58", margin: "4px 0 0", textAlign: "center" }}>
                Enter envia · Shift+Enter nova linha · feche e reabra para conversa nova
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
