"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { AgenteBriefingDrawer } from "@/components/crm/AgenteBriefingChatPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  Operações: "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

const DIAS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EIXOS = [
  {
    nome: "Analítico / Criativo",
    frases: [
      "Baseie todas as respostas em dados e lógica. Evite linguagem subjetiva.",
      "Priorize dados, mas use analogias simples para clareza quando necessário.",
      "Equilibre argumentos racionais com exemplos práticos e linguagem acessível.",
      "Use linguagem envolvente, exemplos criativos e storytelling leve.",
      "Seja criativo, use metáforas e linguagem que engaje emocionalmente.",
    ],
  },
  {
    nome: "Formal / Informal",
    frases: [
      "Mantenha linguagem completamente formal. Sem contrações nem gírias.",
      "Linguagem profissional e clara, pode usar contrações ocasionalmente.",
      "Tom neutro e acessível, nem muito formal nem coloquial.",
      "Linguagem descontraída e próxima, como conversa entre colegas.",
      "Totalmente informal: uso de gírias leves e tom de conversa casual.",
    ],
  },
  {
    nome: "Direto / Detalhista",
    frases: [
      "Seja extremamente conciso. Máximo 2 frases por resposta.",
      "Respostas curtas com a informação essencial. Evite explicações longas.",
      "Resposta completa mas sem excessos. Explique o necessário.",
      "Inclua contexto e justificativas relevantes nas respostas.",
      "Seja completo e detalhado. Antecipe dúvidas e inclua exemplos.",
    ],
  },
  {
    nome: "Conservador / Arrojado",
    frases: [
      "Seja cauteloso. Prefira caminhos testados e seguros. Aponte riscos.",
      "Sugira caminhos tradicionais como padrão, mas apresente alternativas.",
      "Equilibre sugestões convencionais com oportunidades inovadoras.",
      "Proponha abordagens ousadas e diferenciadas. Destaque oportunidades.",
      "Seja provocador e disruptivo. Proponha ideias inovadoras.",
    ],
  },
  {
    nome: "Empático / Objetivo",
    frases: [
      "Priorize o lado humano: valide sentimentos antes de resolver.",
      "Reconheça o contexto emocional antes de apresentar soluções.",
      "Equilibre empatia e objetividade. Valide brevemente e siga para a solução.",
      "Foque na solução e nos resultados práticos. Seja cordial mas eficiente.",
      "Totalmente focado em resultado e eficiência. Sem rodeios emocionais.",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciais(nome: string): string {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function gerarPersonalidade(valores: number[]): string {
  return (
    "## Tom e estilo de comunicação\n\n" +
    EIXOS.map((e, i) => e.frases[valores[i] - 1]).join("\n")
  );
}

function nivelTag(nivel: string | number | undefined): string {
  if (nivel === undefined || nivel === null) return "";
  return typeof nivel === "number" ? `N${nivel}` : nivel;
}

function parsearValores(texto: string): number[] {
  const linhas = (texto || "").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  return EIXOS.map((eixo, i) => {
    const idx = eixo.frases.findIndex((f) => linhas[i]?.trim() === f.trim());
    return idx >= 0 ? idx + 1 : 3;
  });
}

type Agente = {
  agente_slug: string;
  nome: string;
  cargo?: string;
  area?: string;
  nivel?: string | number;
  modelo_padrao?: string;
  prefixo_mercado?: string;
  personalidade?: string;
  bio?: string;
  tom_voz?: string;
  estilo_comunicacao?: string;
  system_prompt_base?: string;
  horario_inicio?: string;
  horario_fim?: string;
  dias_semana?: number[];
  arquivado_em?: string | null;
  ativo?: boolean;
  [key: string]: unknown;
};

/** Alinha com `hub_agente_identidade`: arquivado_em > coluna ativo (inativo ≠ arquivado). */
function badgeStatusAgente(agente: Pick<Agente, "arquivado_em" | "ativo">): {
  label: string;
  bg: string;
  fg: string;
  border: string;
} {
  if (agente.arquivado_em) {
    return { label: "Arquivado", bg: "#ef444422", fg: "#ef4444", border: "#ef444444" };
  }
  if (agente.ativo === false) {
    return { label: "Inativo", bg: "#3f1515", fg: "#fca5a5", border: "#7f1d1d66" };
  }
  return { label: "Ativo", bg: "#22c55e22", fg: "#22c55e", border: "#22c55e44" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [agente, setAgente] = useState<Agente | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Campos editáveis
  const [nome, setNome] = useState("");
  const [mercados, setMercados] = useState<string[]>([]);
  const [valores, setValores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("22:00");
  const [diasSemana, setDiasSemana] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const [bio, setBio] = useState("");
  const [tomVoz, setTomVoz] = useState("");
  const [estiloComunicacao, setEstiloComunicacao] = useState("");
  const [systemPromptBase, setSystemPromptBase] = useState("");

  // UI state
  const [showArquivar, setShowArquivar] = useState(false);
  const [motivoArquivamento, setMotivoArquivamento] = useState("");
  const [arquivando, setArquivando] = useState(false);
  const [showConfirmSalvar, setShowConfirmSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");
  const [erro, setErro] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);

  const carregar = useCallback(async () => {
    if (!slug) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/hub/agentes/${slug}`, { headers: internalApiHeaders() });
      if (res.ok) {
        const data = (await res.json()) as Agente;
        setAgente(data);
        // Popular campos editáveis
        setNome(data.nome || "");
        setMercados(
          (data.prefixo_mercado || "")
            .split(",")
            .map((m: string) => m.trim())
            .filter(Boolean)
        );
        setValores(parsearValores(data.personalidade || ""));
        setHorarioInicio(data.horario_inicio || "08:00");
        setHorarioFim(data.horario_fim || "22:00");
        setDiasSemana(data.dias_semana || [0, 1, 2, 3, 4, 5, 6]);
        setBio(data.bio || "");
        setTomVoz(data.tom_voz || "");
        setEstiloComunicacao(data.estilo_comunicacao || "");
        setSystemPromptBase(data.system_prompt_base || "");
      }
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, [slug]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggleMercado(m: string) {
    setMercados((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleDia(d: number) {
    setDiasSemana((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  function setValor(i: number, v: number) {
    setValores((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });
  }

  async function confirmarArquivamento() {
    if (motivoArquivamento.trim().length < 10) return;
    setArquivando(true);
    try {
      const res = await fetch(`/api/hub/agentes/${slug}/arquivar`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoArquivamento.trim() }),
      });
      if (res.ok) {
        router.push("/crm/agentes");
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string };
        setErro(data.erro || "Falha ao arquivar.");
        setShowArquivar(false);
      }
    } catch {
      setErro("Falha na requisição.");
      setShowArquivar(false);
    } finally {
      setArquivando(false);
    }
  }

  async function salvar() {
    if (!agente) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${slug}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          prefixo_mercado: mercados.join(","),
          personalidade: gerarPersonalidade(valores),
          horario_inicio: horarioInicio,
          horario_fim: horarioFim,
          dias_semana: diasSemana,
          bio,
          tom_voz: tomVoz,
          estilo_comunicacao: estiloComunicacao,
          system_prompt_base: systemPromptBase,
        }),
      });
      if (res.ok) {
        setToast("✓ Salvo");
        setTimeout(() => setToast(""), 3000);
        setShowConfirmSalvar(false);
        await carregar();
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string; error?: string };
        setErro(data.erro || data.error || "Erro ao salvar.");
        setShowConfirmSalvar(false);
      }
    } catch {
      setErro("Falha na requisição.");
      setShowConfirmSalvar(false);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando agente...</p>
      </div>
    );
  }

  if (!agente) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: "#8b949e", fontSize: 13 }}>Agente não encontrado.</p>
        <button
          onClick={() => router.push("/crm/agentes")}
          style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: "#161b22", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer",
          }}
        >
          ← Voltar para agentes
        </button>
      </div>
    );
  }

  const segCor = SEGMENTO_COR[agente.area || ""] || "#8b949e";
  const nivelCor = NIVEL_COR[nivelTag(agente.nivel)] || "#8b949e";
  const statusBadge = badgeStatusAgente(agente);

  const chipStyle = (ativo: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${ativo ? "#c9a24a" : "#30363d"}`,
    background: ativo ? "#c9a24a22" : "#161b22",
    color: ativo ? "#c9a24a" : "#8b949e",
    transition: "all 150ms",
  });

  const inputStyle: React.CSSProperties = {
    background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3",
    borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };

  const inputDisabledStyle: React.CSSProperties = {
    ...inputStyle,
    color: "#8b949e", cursor: "not-allowed", opacity: 0.6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117" }}>

      {/* MODAL ARQUIVAR */}
      {showArquivar && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowArquivar(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div style={{
            background: "#161b22", border: "1px solid #30363d", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 460,
          }}>
            <h2 style={{ color: "#e6edf3", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
              Arquivar agente
            </h2>
            <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 14px" }}>
              Agente: <strong style={{ color: "#e6edf3" }}>{agente.nome}</strong>
            </p>

            {/* Aviso */}
            <div style={{
              background: "#ef444411", border: "1px solid #ef444433",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            }}>
              <p style={{ color: "#ef4444", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                Esta ação não pode ser desfeita pelo UI.
              </p>
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              Motivo do arquivamento <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              value={motivoArquivamento}
              onChange={(e) => setMotivoArquivamento(e.target.value)}
              placeholder="Descreva o motivo (mínimo 10 caracteres)..."
              rows={3}
              style={{
                ...inputStyle, resize: "none", marginBottom: 6,
                border: `1px solid ${motivoArquivamento.length > 0 && motivoArquivamento.trim().length < 10 ? "#ef4444" : "#30363d"}`,
              }}
            />
            {motivoArquivamento.length > 0 && motivoArquivamento.trim().length < 10 && (
              <p style={{ color: "#ef4444", fontSize: 11, margin: "0 0 12px" }}>
                Mínimo 10 caracteres ({motivoArquivamento.trim().length}/10)
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowArquivar(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: "#21262d", border: "1px solid #30363d",
                  color: "#8b949e", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarArquivamento}
                disabled={arquivando || motivoArquivamento.trim().length < 10}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: motivoArquivamento.trim().length >= 10 ? "#dc2626" : "#30363d",
                  border: "none", color: "white", fontSize: 13, fontWeight: 700,
                  cursor: arquivando || motivoArquivamento.trim().length < 10 ? "not-allowed" : "pointer",
                  opacity: arquivando ? 0.6 : 1,
                }}
              >
                {arquivando ? "Arquivando..." : "Confirmar arquivamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR SALVAR */}
      {showConfirmSalvar && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmSalvar(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div style={{
            background: "#161b22", border: "1px solid #30363d", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 420,
          }}>
            <h2 style={{ color: "#e6edf3", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
              Confirmar alterações
            </h2>
            <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Confirmar alterações no agente{" "}
              <strong style={{ color: "#e6edf3" }}>{nome}</strong>?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirmSalvar(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: "#21262d", border: "1px solid #30363d",
                  color: "#8b949e", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: "#003b26", border: "none",
                  color: "#c9a24a", fontSize: 13, fontWeight: 700,
                  cursor: salvando ? "wait" : "pointer",
                  opacity: salvando ? 0.6 : 1,
                }}
              >
                {salvando ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#161b22",
        borderBottom: "1px solid #30363d",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* TOPO ESQUERDA: avatar + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", color: "#8b949e", fontSize: 18, cursor: "pointer", lineHeight: 1, marginRight: 4 }}
          >
            ←
          </button>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: segCor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "white", flexShrink: 0,
            }}
          >
            {iniciais(agente.nome)}
          </div>
          <div>
            <h1 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
              {agente.nome}
            </h1>
            <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 6px" }}>
              {agente.cargo}
              <span style={{ color: "#444c56", marginLeft: 6 }}>@{agente.agente_slug}</span>
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: statusBadge.bg,
                  color: statusBadge.fg,
                  border: `1px solid ${statusBadge.border}`,
                }}
              >
                {statusBadge.label}
              </span>
              {agente.area && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: segCor + "22", color: segCor, border: `1px solid ${segCor}44`,
                }}>
                  {agente.area}
                </span>
              )}
              {agente.nivel && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: nivelCor + "22", color: nivelCor, border: `1px solid ${nivelCor}44`,
                }}>
                  {nivelTag(agente.nivel)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TOPO DIREITA */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {toast && (
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>{toast}</span>
          )}
          {erro && (
            <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 220 }}>{erro}</span>
          )}
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            style={{
              padding: "8px 16px", borderRadius: 8,
              background: "#c9a24a18", border: "1px solid #c9a24a66",
              color: "#d6b976", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Briefing IA
          </button>
          <button
            onClick={() => { setShowArquivar(true); setMotivoArquivamento(""); }}
            style={{
              padding: "8px 16px", borderRadius: 8,
              background: "transparent", border: "1px solid #ef4444",
              color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Arquivar agente
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "28px 28px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* BLOCO: Configurações fixas */}
        <div>
          {/* Banner amarelo */}
          <div style={{
            background: "#c9a24a11", border: "1px solid #c9a24a33",
            borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          }}>
            <p style={{ color: "#c9a24a", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              Cargo, segmento, nível e modelo são imutáveis após criação — protegidos por trigger no banco.
            </p>
          </div>

          <div style={{
            background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <h2 style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>
              Configurações fixas
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>Cargo</label>
                <input
                  value={agente.cargo || "—"}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>Área</label>
                <input
                  value={agente.area || "—"}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>Nível</label>
                <div style={{
                  ...inputDisabledStyle, display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                }}>
                  {agente.nivel ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: nivelCor + "22", color: nivelCor, border: `1px solid ${nivelCor}44`,
                    }}>
                      {nivelTag(agente.nivel)}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>Modelo padrão</label>
                <input
                  value={agente.modelo_padrao as string || "—"}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO: Configurações editáveis */}
        <div style={{
          background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 20,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          <h2 style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>
            Configurações editáveis
          </h2>

          {/* Nome */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              Nome
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Mercados */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 10 }}>
              Mercados
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MERCADOS_FIXOS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMercado(m)}
                  style={chipStyle(mercados.includes(m))}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Personalidade — 5 eixos */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 14 }}>
              Personalidade
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
              {EIXOS.map((eixo, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#8b949e", fontWeight: 700 }}>{eixo.nome}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((v) => {
                      const ativo = valores[i] === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setValor(i, v)}
                          style={{
                            width: 34, height: 34, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", border: `2px solid ${ativo ? "#c9a24a" : "#30363d"}`,
                            background: ativo ? "#c9a24a" : "#0d1117",
                            color: ativo ? "#003b26" : "#8b949e",
                            transition: "all 150ms",
                          }}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 10 }}>
              Horário de atendimento
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              />
              <span style={{ color: "#8b949e", fontSize: 13 }}>até</span>
              <input
                type="time"
                value={horarioFim}
                onChange={(e) => setHorarioFim(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              />
            </div>
          </div>

          {/* Dias da semana */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 10 }}>
              Dias da semana
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DIAS_LABELS.map((label, idx) => {
                const ativo = diasSemana.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDia(idx)}
                    style={chipStyle(ativo)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Tom de voz */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              Tom de voz
            </label>
            <input
              value={tomVoz}
              onChange={(e) => setTomVoz(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Estilo de comunicação */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              Estilo de comunicação
            </label>
            <input
              value={estiloComunicacao}
              onChange={(e) => setEstiloComunicacao(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* System prompt base */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}>
              System prompt base
            </label>
            <textarea
              value={systemPromptBase}
              onChange={(e) => setSystemPromptBase(e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Botão salvar */}
          <button
            onClick={() => setShowConfirmSalvar(true)}
            style={{
              padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "#003b26", border: "none", color: "#c9a24a", cursor: "pointer",
            }}
          >
            Salvar alterações
          </button>
        </div>
      </div>

      <AgenteBriefingDrawer
        open={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        agenteSlug={slug}
        agenteNome={agente.nome}
      />
    </div>
  );
}
