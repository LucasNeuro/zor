"use client";

import { useState, useMemo, useCallback } from "react";
import type { Agent } from "./OfficeCanvas";
import { HUMORES, PERSONALIDADES, getPerfil, type Humor, type Personalidade } from "@/lib/personality-matrix";

interface Props {
  agent: Agent;
  onClose: () => void;
}

interface ConversationMessage {
  remetente: string;
  mensagem: string;
  tempo: string;
  tipo: "enviou" | "recebeu" | "decidiu" | "alertou";
}

function getActivityText(agent: Agent): string {
  if (agent.currentActivity) return agent.currentActivity;
  const fn = agent.funcao.toLowerCase();
  if (fn.includes("ceo"))           return "Revisando relatório executivo do trimestre";
  if (fn.includes("gerente"))       return "Coordenando entregas e aprovando briefings";
  if (fn.includes("plano"))         return "Elaborando estratégia para nova campanha";
  if (fn.includes("brief"))         return "Coletando e validando briefing do cliente";
  if (fn.includes("agenda"))        return "Atualizando calendário editorial da semana";
  if (fn.includes("copy"))         return "Criando copy de alta conversão para anúncios";
  if (fn.includes("designer grá")) return "Desenvolvendo arte para campanha Meta Ads";
  if (fn.includes("ui/ux"))        return "Otimizando landing page para conversão";
  if (fn.includes("motion"))       return "Animando reel de 15s para Instagram";
  if (fn.includes("google"))       return "Ajustando lances e segmentações no Google";
  if (fn.includes("meta"))         return "Escalando criativos vencedores no Meta";
  if (fn.includes("analytics"))    return "Analisando performance das campanhas do dia";
  if (fn.includes("social media")) return "Publicando e monitorando conteúdo das redes";
  if (fn.includes("criador"))      return "Produzindo conteúdo criativo para o feed";
  if (fn.includes("community"))    return "Respondendo comentários e mensagens";
  if (fn.includes("atendimento"))  return "Qualificando leads na fila de atendimento";
  if (fn.includes("recepcionista")) return "Recebendo e triando novos contatos";
  return "Trabalhando em tarefa de alta prioridade";
}

function generateConversation(agent: Agent): ConversationMessage[] {
  const fn = agent.funcao.toLowerCase();

  if (fn.includes("copy")) {
    return [
      { remetente: "Brief IA",     mensagem: "Briefing do cliente finalizado e validado. Pode iniciar a copy.", tempo: "3h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Copy do anúncio finalizada — 3 variações para teste A/B criadas.", tempo: "2h atrás", tipo: "enviou"  },
      { remetente: "Design Alpha", mensagem: "Recebi as copies. Vou criar os layouts em cima delas.", tempo: "2h atrás", tipo: "recebeu" },
      { remetente: "Marina Costa", mensagem: "Aprovada a variação B para subir como principal. Boa execução!", tempo: "1h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Criando headline alternativas para campanha de retargeting.", tempo: "Agora",    tipo: "enviou"  },
    ];
  }
  if (fn.includes("design") || fn.includes("motion")) {
    return [
      { remetente: "Copy Alpha",   mensagem: "Copy finalizada e enviada. Aguardando arte para subir.",     tempo: "3h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Layout 1 entregue para revisão. Exportado em 4 formatos.",    tempo: "2h atrás", tipo: "enviou"  },
      { remetente: "Marina Costa", mensagem: "Aprovado o layout 1. Pode finalizar os tamanhos de stories.", tempo: "1h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Finalizando pack de stories. Entrego em 30 minutos.",          tempo: "45min",   tipo: "enviou"  },
      { remetente: "Tráfego Alpha",mensagem: "Pode mandar os assets quando estiver pronto. Campanha aguarda.", tempo: "Agora",  tipo: "recebeu" },
    ];
  }
  if (fn.includes("tráfego") || fn.includes("google") || fn.includes("meta")) {
    return [
      { remetente: "Sistema",      mensagem: "ALERTA: CPL acima da meta por 2h consecutivas. Verificar criativos.", tempo: "4h atrás", tipo: "alertou" },
      { remetente: agent.nome,     mensagem: "Pausa nos conjuntos com baixo CTR. Subindo variações B.",               tempo: "3h atrás", tipo: "enviou"  },
      { remetente: "Analytics IA", mensagem: "Variação B com CTR 32% maior. Sugiro escalar.",                          tempo: "2h atrás", tipo: "recebeu" },
      { remetente: "Marina Costa", mensagem: "Aprovado escalar variação B com +40% de budget.",                        tempo: "1h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Budget redistribuído. ROAS atual 4.2x. Monitorando.",                    tempo: "Agora",   tipo: "enviou"  },
    ];
  }
  if (fn.includes("analytics")) {
    return [
      { remetente: "Tráfego Alpha",mensagem: "Pode gerar o relatório de performance da semana?",              tempo: "5h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Relatório gerado. Destaque: ROAS 4.2x, CPL 11% abaixo da meta.", tempo: "3h atrás", tipo: "enviou"  },
      { remetente: "Lucas Ferreira",mensagem: "Bom resultado. Precisamos manter acima de 3.5x no próximo mês.",tempo: "2h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Entendido. Vou incluir projeção no próximo relatório.",           tempo: "2h atrás", tipo: "enviou"  },
      { remetente: agent.nome,     mensagem: "Analisando performance do dia. Dashboard atualizado.",            tempo: "Agora",   tipo: "enviou"  },
    ];
  }
  if (fn.includes("social") || fn.includes("community") || fn.includes("criador")) {
    return [
      { remetente: "Agenda IA",    mensagem: "Lembrete: 3 publicações agendadas para hoje. Conteúdo aprovado.", tempo: "5h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Post 1 e 2 publicados. Engajamento nas primeiras 2h: 6.8%.",       tempo: "3h atrás", tipo: "enviou"  },
      { remetente: "Marina Costa", mensagem: "Ótimo engajamento! Pode impulsionar o post 2 com R$ 50.",          tempo: "2h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Post impulsionado. Alcance projetado: 18k.",                        tempo: "1h atrás", tipo: "enviou"  },
      { remetente: agent.nome,     mensagem: "Publicando conteúdo 3 e monitorando comentários.",                  tempo: "Agora",   tipo: "enviou"  },
    ];
  }
  if (fn.includes("atendimento") || fn.includes("recepcionista")) {
    return [
      { remetente: "Lead #47",     mensagem: "Olá, quero saber mais sobre os planos de gestão de campanhas.",    tempo: "2h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Oi! Vou coletar algumas informações para te atender melhor.",       tempo: "2h atrás", tipo: "enviou"  },
      { remetente: "Lead #47",     mensagem: "Empresa de e-commerce, budget R$ 5k/mês, foco em Meta Ads.",        tempo: "1h atrás", tipo: "recebeu" },
      { remetente: agent.nome,     mensagem: "Lead qualificado. Encaminhando para reunião com Marina Costa.",      tempo: "1h atrás", tipo: "decidiu" },
      { remetente: agent.nome,     mensagem: "Atendendo próximo lead na fila. CRM atualizado.",                   tempo: "Agora",   tipo: "enviou"  },
    ];
  }
  /* exec / strategy */
  return [
    { remetente: "Analytics IA",  mensagem: "Relatório semanal disponível. Performance geral acima das metas.", tempo: "4h atrás", tipo: "recebeu" },
    { remetente: agent.nome,       mensagem: "Revisado. Ajustando metas do próximo ciclo com base nos dados.",    tempo: "3h atrás", tipo: "enviou"  },
    { remetente: "Tráfego Alpha",  mensagem: "Campanha Q2 pronta para lançar. Precisa de aprovação.",            tempo: "2h atrás", tipo: "recebeu" },
    { remetente: agent.nome,       mensagem: "Campanha aprovada. Budget R$ 8.000. Pode ativar.",                  tempo: "1h atrás", tipo: "decidiu" },
    { remetente: agent.nome,       mensagem: "Coordenando entregas e alinhando prioridades da semana.",           tempo: "Agora",   tipo: "enviou"  },
  ];
}

function scoreColor(s: number) {
  return s >= 85 ? "#22c55e" : s >= 70 ? "#eab308" : "#ef4444";
}
function govColorDark(s: number) {
  return s >= 85 ? "#14532d" : s >= 70 ? "#713f12" : "#7f1d1d";
}

/* ── Message bubble ── */
function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isSelf     = msg.tipo === "enviou";
  const isDecision = msg.tipo === "decidiu";
  const isAlert    = msg.tipo === "alertou";

  if (isDecision || isAlert) {
    const color = isDecision ? "#3b82f6" : "#ef4444";
    const bg    = isDecision ? "rgba(59,130,246,0.10)" : "rgba(239,68,68,0.10)";
    const border= isDecision ? "rgba(59,130,246,0.22)" : "rgba(239,68,68,0.22)";
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color }}>{isDecision ? "🔵 Decisão" : "🔴 Alerta"} — {msg.remetente}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>{msg.tempo}</span>
          </div>
          <p style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.4 }}>{msg.mensagem}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{msg.remetente}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>·</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{msg.tempo}</span>
      </div>
      <div
        style={{
          maxWidth: "88%",
          background: isSelf ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
          border: isSelf ? "1px solid rgba(34,197,94,0.22)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: isSelf ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          padding: "7px 10px",
        }}
      >
        <p style={{ fontSize: 12, color: isSelf ? "#bbf7d0" : "#e2e8f0", lineHeight: 1.4 }}>{msg.mensagem}</p>
      </div>
    </div>
  );
}

interface EditDraft {
  nome: string;
  funcao: string;
  area: string;
  humor: Humor;
  personalidade: Personalidade;
}

/* ── Main Component ── */
export function AgentLogPanel({ agent, onClose }: Props) {
  const [tab, setTab] = useState<"conversas" | "perfil" | "editar">("conversas");
  const [draft, setDraft] = useState<EditDraft>({
    nome: agent.nome,
    funcao: agent.funcao,
    area: agent.area ?? "",
    humor: (agent.perfil.humor as Humor) ?? "Analítico",
    personalidade: (agent.perfil.personalidade as Personalidade) ?? "Formal",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const previewPerfil = getPerfil(draft.humor, draft.personalidade);

  const handleSave = useCallback(async () => {
    if (!previewPerfil) return;
    setSaving(true);
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: draft.nome,
          funcao: draft.funcao,
          area: draft.area,
          perfil: {
            ...agent.perfil,
            humor: draft.humor,
            personalidade: draft.personalidade,
            tom_comunicacao: previewPerfil.tom_comunicacao,
            estilo_trabalho: previewPerfil.estilo_trabalho,
            reacao_alerta: previewPerfil.reacao_alerta,
            reacao_comemorar: previewPerfil.reacao_comemorar,
            reacao_reuniao: previewPerfil.reacao_reuniao,
            frases_trabalhando: previewPerfil.frase_trabalhando,
            frases_alerta: previewPerfil.frase_alerta,
            frases_comemorando: previewPerfil.frase_comemorando,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [agent, draft, previewPerfil]);

  const conversation = useMemo(() => generateConversation(agent), [agent.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const activity     = getActivityText(agent);

  const score   = agent.governanca.score;
  const sc      = scoreColor(score);
  const online  = agent.status.online;
  const needsAction = agent.needsUserDecision === true;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.20)" }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, width: 400, height: "100vh",
          background: "#0f172a",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 1000,
          display: "flex", flexDirection: "column",
          animation: "slideInRight 350ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 20px 0",
            flexShrink: 0,
            background: "linear-gradient(180deg, rgba(34,197,94,0.07) 0%, transparent 55%)",
          }}
        >
          {/* Name row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                background: govColorDark(score),
                border: `2px solid ${sc}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: sc, fontFamily: "monospace",
              }}
            >
              {agent.avatar}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{agent.nome}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{agent.funcao}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{
                  background: online ? "#22c55e18" : "#6b728018",
                  color: online ? "#22c55e" : "#9ca3af",
                  border: `1px solid ${online ? "#22c55e44" : "#6b728044"}`,
                  borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                }}>
                  {online ? "🟢 Online" : "⚫ Offline"}
                </span>
                <span style={{ background: "rgba(255,255,255,0.06)", color: sc, border: `1px solid ${sc}33`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                  {score}% saúde
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.18)"; (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {(["conversas", "perfil", "editar"] as const).map((t) => {
              const labels = { conversas: "💬 Conversas", perfil: "🎭 Perfil", editar: "✏️ Editar" };
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: "10px 4px",
                    background: "transparent", border: "none",
                    borderBottom: active ? "2px solid #22c55e" : "2px solid transparent",
                    color: active ? "#22c55e" : "rgba(255,255,255,0.40)",
                    fontWeight: active ? 700 : 500, fontSize: 12,
                    cursor: "pointer", transition: "all 150ms",
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 80px" }}>

          {/* ── SEÇÃO 1: O que está fazendo ── */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
              O QUE ESTÁ FAZENDO AGORA
            </p>
            <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>
              💭 {activity}
            </p>
          </div>

          {/* ── TAB: CONVERSAS ── */}
          {tab === "conversas" && (
            <div>
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 14 }}>
                ÚLTIMAS CONVERSAS
              </p>
              {conversation.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
            </div>
          )}

          {/* ── TAB: EDITAR ── */}
          {tab === "editar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {/* SEÇÃO 1 — Identidade */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 12 }}>IDENTIDADE</p>
                {(["nome", "funcao", "area"] as const).map((field) => (
                  <div key={field} style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 4 }}>
                      {field === "nome" ? "NOME" : field === "funcao" ? "CARGO" : "ÁREA"}
                    </p>
                    <input
                      type="text"
                      value={draft[field]}
                      onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "#e2e8f0", fontSize: 12, padding: "7px 10px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
                    />
                  </div>
                ))}
              </div>

              {/* SEÇÃO 2 — Seleção de personalidade */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>PERFIL DO AGENTE</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginBottom: 14 }}>Selecione humor e personalidade. Os campos são gerados automaticamente.</p>

                {/* Humor */}
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 8 }}>HUMOR</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {HUMORES.map((h) => (
                    <button
                      key={h}
                      onClick={() => setDraft((p) => ({ ...p, humor: h }))}
                      style={{
                        padding: "6px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", transition: "all 150ms",
                        background: draft.humor === h ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                        border: draft.humor === h ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color: draft.humor === h ? "#22c55e" : "rgba(255,255,255,0.5)",
                        fontWeight: draft.humor === h ? 600 : 400,
                      }}
                    >
                      {h}
                    </button>
                  ))}
                </div>

                {/* Personalidade */}
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 8 }}>PERSONALIDADE</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PERSONALIDADES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setDraft((prev) => ({ ...prev, personalidade: p }))}
                      style={{
                        padding: "6px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", transition: "all 150ms",
                        background: draft.personalidade === p ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.05)",
                        border: draft.personalidade === p ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color: draft.personalidade === p ? "#60a5fa" : "rgba(255,255,255,0.5)",
                        fontWeight: draft.personalidade === p ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 3 — Gerado automaticamente */}
              {previewPerfil && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 999, padding: "2px 8px", fontSize: 10, color: "#22c55e", fontWeight: 700 }}>
                      Perfil #{previewPerfil.id}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{draft.humor} + {draft.personalidade}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>· {previewPerfil.descricao_curta}</span>
                  </div>

                  {[
                    { label: "TOM DE COMUNICAÇÃO",    val: previewPerfil.tom_comunicacao  },
                    { label: "ESTILO DE TRABALHO",    val: previewPerfil.estilo_trabalho  },
                    { label: "COMO REAGE A ALERTAS",  val: previewPerfil.reacao_alerta    },
                    { label: "COMO COMEMORA",         val: previewPerfil.reacao_comemorar },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.5 }}>{val}</p>
                    </div>
                  ))}

                  <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 4 }}>EXEMPLO DE FRASE</p>
                    <p style={{ fontSize: 11, color: "#a78bfa", fontStyle: "italic" }}>"{previewPerfil.frase_trabalhando[0]}"</p>
                  </div>

                  <p style={{ fontSize: 9, color: "#eab308", marginTop: 10 }}>⚠️ Mudar a combinação altera o comportamento completo do agente</p>
                </div>
              )}

              {/* Botões */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setDraft({ nome: agent.nome, funcao: agent.funcao, area: agent.area ?? "", humor: (agent.perfil.humor as Humor) ?? "Analítico", personalidade: (agent.perfil.personalidade as Personalidade) ?? "Formal" })}
                  style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 2, padding: "9px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: saved ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.18)", border: `1px solid ${saved ? "rgba(34,197,94,0.55)" : "rgba(34,197,94,0.35)"}`, color: saved ? "#86efac" : "#22c55e", cursor: saving ? "default" : "pointer" }}
                >
                  {saved ? "✅ Aplicado!" : saving ? "Aplicando..." : "Aplicar Perfil"}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: PERFIL ── */}
          {tab === "perfil" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Personalidade */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>PERSONALIDADE</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ background: "rgba(167,139,250,0.14)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.22)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                    {agent.perfil.humor}
                  </span>
                  <span style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.20)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                    {agent.perfil.personalidade}
                  </span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}>
                  <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 10, marginBottom: 4 }}>Tom de comunicação</p>
                  <p style={{ color: "#a78bfa", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>"{agent.perfil.tom_comunicacao}"</p>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "9px 11px" }}>
                  <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 10, marginBottom: 4 }}>Estilo de trabalho</p>
                  <p style={{ color: "#93c5fd", fontSize: 12, fontStyle: "italic", lineHeight: 1.5 }}>"{agent.perfil.estilo_trabalho}"</p>
                </div>
              </div>

              {/* Stats */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>HOJE</p>
                {[
                  { label: "Em andamento",     value: String(agent.tarefas.ativas),         color: "#60a5fa" },
                  { label: "Concluídas hoje",  value: String(agent.tarefas.concluidas_hoje), color: "#22c55e" },
                  { label: "Saúde da operação",value: `${score}%`,                           color: sc       },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.40)", fontSize: 12 }}>{label}</span>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RODAPÉ FIXO: Você precisa fazer algo? ── */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "12px 20px 16px",
            background: needsAction ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.07)",
            borderTop: `1px solid ${needsAction ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.14)"}`,
            backdropFilter: "blur(8px)",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.30)", marginBottom: 6 }}>
            VOCÊ PRECISA FAZER ALGO?
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: needsAction ? "#fca5a5" : "#86efac" }}>
              {needsAction
                ? `⚠️ ${agent.decisionDescription || "Decisão pendente"}`
                : "✅ Nenhuma ação necessária"}
            </p>
            {needsAction && (
              <button style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: "rgba(239,68,68,0.22)", border: "1px solid rgba(239,68,68,0.40)",
                color: "#fca5a5", cursor: "pointer",
              }}>
                Decidir →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
