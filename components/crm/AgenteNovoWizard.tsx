"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Clock, MessageSquare, Zap, Webhook } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  CONHECIMENTO_SECAO_ORDER,
  CONHECIMENTO_TITULO_INSERT,
} from "@/lib/hub/conhecimento-secoes";
import {
  MODO_OPERACAO_DESCRICAO,
  MODO_OPERACAO_LABEL,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";

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

const SECOES_CONHECIMENTO = [
  {
    id: "fluxo_sdr",
    label: "Núcleo POP / fluxo operacional",
    placeholder:
      "## 1. Objetivo\n(O que este modelo deve cumprir neste canal: informar, qualificar, registar, encaminhar, resolver 1ª linha — conforme o cargo.)\n\n## 2. Escopo\n- Tipos de pedido ou tema que trata\n- O que fica fora da responsabilidade do modelo\n\n## 3. Triagem ou classificação\n| Tipo | Quando |\n|------|--------|\n| … | … |\n\n## 4. Perguntas ou dados obrigatórios\n1. …\n2. …\n\n## 5. Critérios (ex.: prioridade, caso encerrado vs precisa de humano)\n- …\n\n## 6. Encaminhamento, próximos passos e SLA\n- …\n\n## 7. Escalação para humano\n- …",
  },
  { id: "empresa", label: "Sobre o negócio", placeholder: "Quem somos, missão, diferenciais, proposta de valor, histórico..." },
  { id: "servicos", label: "Serviços", placeholder: "Detalhes de cada serviço, faixas de preço, prazos médios, garantias..." },
  { id: "atendimento", label: "Como atender", placeholder: "Fluxo de atendimento, perguntas que deve fazer, tom de voz, condução do lead..." },
  { id: "proibicoes", label: "Nunca fazer", placeholder: "O que nunca prometer, quando escalar para humano, temas proibidos..." },
  { id: "objeccoes", label: "Objeções comuns", placeholder: "Objeções frequentes e como responder. Ex: 'tá caro', 'vou pensar'..." },
  { id: "exemplos", label: "Exemplos de atendimento", placeholder: "Exemplos de boas conversas, casos reais, respostas modelo..." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarPersonalidade(valores: number[]): string {
  return (
    "## Tom e estilo de comunicação\n\n" +
    EIXOS.map((e, i) => e.frases[valores[i] - 1]).join("\n")
  );
}

function montarPrompt(conhecimento: Record<string, string>): string {
  return CONHECIMENTO_SECAO_ORDER.map((id) => {
    const v = (conhecimento[id] || "").trim();
    if (!v) return null;
    return `## ${CONHECIMENTO_TITULO_INSERT[id]}\n\n${v}`;
  })
    .filter((b): b is string => b != null)
    .join("\n\n");
}

export type Cargo = {
  slug: string;
  titulo: string;
  descricao_curta?: string;
  descricao?: string;
  segmento?: string;
  especialidade?: string;
  nivel?: string;
  modelo_padrao?: string;
  [key: string]: unknown;
};

type HubCicloPickListItem = {
  id: string;
  nome: string;
  agente_slug: string;
  tipo: string;
  ativo: boolean;
};

function hubCicloTipoLabel(tipo: string): string {
  if (tipo === "continuo") return "contínuo";
  if (tipo === "programado") return "programado";
  if (tipo === "gatilho") return "gatilho";
  return tipo;
}

export type AgenteNovoWizardProps = {
  variant: "page" | "drawer";
  onClose?: () => void;
  onCreated?: (agente: { agente_slug: string }) => void;
};

export function AgenteNovoWizard({ variant, onClose, onCreated }: AgenteNovoWizardProps) {
  const router = useRouter();

  const [passo, setPasso] = useState(1);
  const [cargoSelecionado, setCargoSelecionado] = useState<Cargo | null>(null);
  const [nome, setNome] = useState("");
  const [mercados, setMercados] = useState<string[]>([]);
  const [valores, setValores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [conhecimento, setConhecimento] = useState<Record<string, string>>({
    fluxo_sdr: "",
    empresa: "",
    servicos: "",
    atendimento: "",
    proibicoes: "",
    objeccoes: "",
    exemplos: "",
  });
  const [criando, setCriando] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erro, setErro] = useState("");

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [filtroSegmento, setFiltroSegmento] = useState<string>("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>("");

  const [abaConhecimento, setAbaConhecimento] = useState("fluxo_sdr");
  const [gerandoIaConhecimento, setGerandoIaConhecimento] = useState<string | null>(null);
  const [erroIaConhecimento, setErroIaConhecimento] = useState("");

  /** Atendimento WhatsApp vs operações internas (cron/ciclos). */
  const [modoOperacao, setModoOperacao] = useState<ModoOperacaoAgente>("canal_whatsapp");
  /** Onde/quando opera: gravado como hub_ciclos_ia (tipo gatilho / continuo / programado). */
  const [modoExecucao, setModoExecucao] = useState<"interacao" | "tempo_real" | "agenda">(
    "interacao"
  );
  const [agendaIntervalMin, setAgendaIntervalMin] = useState<15 | 60 | 360 | 1440>(60);

  /** `provisionar`: cria linha padrão + opcional vincular mais; `somente_vincular`: só atualiza slugs em hub_ciclos_ia. */
  const [hubCicloEstrategia, setHubCicloEstrategia] = useState<"provisionar" | "somente_vincular">(
    "provisionar"
  );
  const [hubCiclosLista, setHubCiclosLista] = useState<HubCicloPickListItem[]>([]);
  const [hubCiclosCarregando, setHubCiclosCarregando] = useState(false);
  const [hubCiclosVincularIds, setHubCiclosVincularIds] = useState<string[]>([]);
  const hubCiclosLoadRef = useRef(false);

  const [erroCargos, setErroCargos] = useState(false);

  useEffect(() => {
    if (passo !== 5) {
      hubCiclosLoadRef.current = false;
      return;
    }
    if (hubCiclosLoadRef.current) return;
    hubCiclosLoadRef.current = true;
    setHubCiclosCarregando(true);
    fetch("/api/hub/ciclos", { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d: { ciclos?: unknown[] }) => {
        const raw = Array.isArray(d?.ciclos) ? d.ciclos : [];
        setHubCiclosLista(
          raw
            .map((c) => {
              const o = c as Record<string, unknown>;
              return {
                id: String(o.id ?? ""),
                nome: String(o.nome ?? ""),
                agente_slug: String(o.agente_slug ?? ""),
                tipo: String(o.tipo ?? ""),
                ativo: o.ativo !== false,
              };
            })
            .filter((c) => c.id.length > 0)
        );
      })
      .catch(() => setHubCiclosLista([]))
      .finally(() => setHubCiclosCarregando(false));
  }, [passo]);

  const carregarCargos = useCallback(() => {
    setCarregando(true);
    setErroCargos(false);
    fetch("/api/hub/cargos", { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCargos(data);
        else if (Array.isArray(data?.cargos)) setCargos(data.cargos);
        else setCargos([]);
      })
      .catch(() => setErroCargos(true))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregarCargos();
  }, [carregarCargos]);

  const segmentos = Array.from(new Set(cargos.map((c) => c.segmento).filter(Boolean))) as string[];

  const especialidades = Array.from(
    new Set(
      cargos
        .filter((c) => !filtroSegmento || c.segmento === filtroSegmento)
        .map((c) => c.especialidade)
        .filter(Boolean)
    )
  ) as string[];

  const cargosFiltrados = cargos.filter((c) => {
    if (filtroSegmento && c.segmento !== filtroSegmento) return false;
    if (filtroEspecialidade && c.especialidade !== filtroEspecialidade) return false;
    return true;
  });

  function toggleMercado(m: string) {
    setMercados((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function toggleHubCicloVincular(id: string) {
    setHubCiclosVincularIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function setValor(i: number, v: number) {
    setValores((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });
  }

  function handleBackClick() {
    if (variant === "drawer" && onClose) onClose();
    else router.back();
  }

  async function gerarSecaoComIa(secaoId: string) {
    if (!cargoSelecionado || !nome.trim()) {
      setErroIaConhecimento("Preencha o nome do agente (passo Identidade) e selecione um cargo.");
      return;
    }
    setErroIaConhecimento("");
    setGerandoIaConhecimento(secaoId);
    try {
      const cargoPayload = {
        slug: cargoSelecionado.slug,
        titulo: cargoSelecionado.titulo,
        segmento: cargoSelecionado.segmento ?? null,
        nivel: cargoSelecionado.nivel ?? null,
        especialidade: cargoSelecionado.especialidade ?? null,
        descricao_curta:
          typeof cargoSelecionado.descricao_curta === "string"
            ? cargoSelecionado.descricao_curta
            : null,
        descricao:
          typeof cargoSelecionado.descricao === "string" ? cargoSelecionado.descricao : null,
      };
      const res = await fetch("/api/hub/agentes/sugerir-conhecimento", {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          secao: secaoId,
          nome_agente: nome.trim(),
          cargo: cargoPayload,
          mercados,
          texto_atual: conhecimento[secaoId] || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
      if (!res.ok) {
        setErroIaConhecimento(data.error || "Falha ao gerar texto.");
        return;
      }
      if (!data.texto?.trim()) {
        setErroIaConhecimento("Resposta vazia do servidor.");
        return;
      }
      setConhecimento((prev) => ({ ...prev, [secaoId]: data.texto!.trim() }));
    } catch {
      setErroIaConhecimento("Falha na requisição.");
    } finally {
      setGerandoIaConhecimento(null);
    }
  }

  async function criarAgente() {
    if (!cargoSelecionado) return;
    setCriando(true);
    setErro("");
    try {
      if (hubCicloEstrategia === "somente_vincular" && hubCiclosVincularIds.length === 0) {
        setErro("Selecione pelo menos um ciclo da Central para associar a este agente.");
        setCriando(false);
        return;
      }

      const payload: Record<string, unknown> = {
        cargo_slug: cargoSelecionado.slug,
        nome,
        prefixo_mercado: mercados.join(","),
        personalidade: gerarPersonalidade(valores),
        system_prompt_base: montarPrompt(conhecimento),
        conhecimento_secoes: conhecimento,
        bio: (conhecimento.empresa?.trim() || conhecimento.fluxo_sdr?.trim() || "").slice(0, 200),
        horario_inicio: "08:00",
        horario_fim: "22:00",
      };

      if (hubCicloEstrategia === "somente_vincular") {
        payload.omit_hub_ciclo_padrao = true;
        payload.ciclos_vincular_ids = hubCiclosVincularIds;
      } else {
        payload.modo_operacao = modoOperacao;
        payload.ciclo_execucao =
          modoOperacao === "canal_whatsapp" ? "interacao" : modoExecucao;
        payload.ciclo_intervalo_minutos =
          modoExecucao === "agenda" ? agendaIntervalMin : undefined;
        if (hubCiclosVincularIds.length > 0) {
          payload.ciclos_vincular_ids = hubCiclosVincularIds;
        }
      }
      const res = await fetch("/api/hub/agentes", {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          agente_slug?: string;
          ciclo_aviso?: string;
          ciclo_erro?: string;
        };
        const slug = data.agente_slug;
        if (data.ciclo_erro) {
          console.error("[CRM] Agent criado mas ciclo padrão falhou:", data.ciclo_erro);
        } else if (data.ciclo_aviso) {
          console.warn("[CRM]", data.ciclo_aviso);
        }
        if (slug && onCreated) onCreated({ agente_slug: slug });
        if (variant === "drawer" && onClose) onClose();
        else router.push("/crm/agentes");
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string; error?: string };
        setErro(data.erro || data.error || "Erro ao criar agente.");
        setShowConfirm(false);
      }
    } catch {
      setErro("Falha na requisição.");
      setShowConfirm(false);
    } finally {
      setCriando(false);
    }
  }

  const personalidadeGerada = gerarPersonalidade(valores);

  const chip = (ativo: boolean, cor?: string): CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${ativo ? cor || "#c9a24a" : "#30363d"}`,
    background: ativo ? (cor ? cor + "22" : "#c9a24a22") : "#161b22",
    color: ativo ? cor || "#c9a24a" : "#8b949e",
    transition: "all 150ms",
  });

  const rootStyle: CSSProperties =
    variant === "page"
      ? { minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column" }
      : {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          background: "#0d1117",
          flex: 1,
        };

  return (
    <div style={rootStyle}>
      {showConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 440,
            }}
          >
            <h2 style={{ color: "#e6edf3", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>
              Confirmar criação
            </h2>
            <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Confirmar criação do agente <strong style={{ color: "#e6edf3" }}>{nome}</strong>?
            </p>
            {erro && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{erro}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#8b949e",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={criarAgente}
                disabled={criando}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: criando ? "wait" : "pointer",
                  opacity: criando ? 0.6 : 1,
                }}
              >
                {criando ? "Criando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#161b22",
          borderBottom: "1px solid #30363d",
          padding: "12px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={handleBackClick}
              style={{
                background: "none",
                border: "none",
                color: "#8b949e",
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ←
            </button>
          </div>
          {cargoSelecionado && nome && (
            <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
              {nome} · {cargoSelecionado.titulo}
            </p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {["Cargo", "Identidade", "Personalidade", "Conhecimento", "Revisão"].map((label, i) => {
            const num = i + 1;
            const ativo = passo === num;
            const passado = passo > num;
            return (
              <div key={num} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: passado ? "#003b26" : ativo ? "#c9a24a" : "#21262d",
                      border: `2px solid ${passado ? "#003b26" : ativo ? "#c9a24a" : "#30363d"}`,
                      color: passado ? "#c9a24a" : ativo ? "#003b26" : "#8b949e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {passado ? "✓" : num}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: ativo ? "#c9a24a" : "#8b949e",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </div>
                {i < 4 && (
                  <div
                    style={{
                      height: 2,
                      flex: 0,
                      width: 16,
                      background: passo > num ? "#c9a24a" : "#30363d",
                      marginBottom: 16,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 48px" }}>
          {passo === 1 && (
            <div>
              <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                Qual é o cargo deste agente?
              </h2>
              <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 20px" }}>
                O cargo define nível e regras; a inferência usa <strong style={{ color: "#8b949e" }}>Mistral</strong> (Agno) via{" "}
                <code style={{ fontSize: 11 }}>MISTRAL_MODEL</code> no servidor.
              </p>

              {carregando ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando cargos...</p>
              ) : erroCargos ? (
                <div>
                  <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 10px" }}>Erro ao carregar cargos.</p>
                  <button
                    type="button"
                    onClick={carregarCargos}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background: "#161b22",
                      border: "1px solid #30363d",
                      color: "#8b949e",
                      cursor: "pointer",
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>SEGMENTO</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroSegmento("");
                          setFiltroEspecialidade("");
                        }}
                        style={chip(filtroSegmento === "")}
                      >
                        Todos
                      </button>
                      {segmentos.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            setFiltroSegmento(s);
                            setFiltroEspecialidade("");
                          }}
                          style={chip(filtroSegmento === s, SEGMENTO_COR[s])}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {especialidades.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                        ESPECIALIDADE
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setFiltroEspecialidade("")}
                          style={chip(filtroEspecialidade === "")}
                        >
                          Todas
                        </button>
                        {especialidades.map((e) => (
                          <button
                            type="button"
                            key={e}
                            onClick={() => setFiltroEspecialidade(e)}
                            style={chip(filtroEspecialidade === e)}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {cargosFiltrados.length === 0 ? (
                    <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum cargo encontrado.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cargosFiltrados.map((c) => {
                        const ativo = cargoSelecionado?.slug === c.slug;
                        const segCor = SEGMENTO_COR[c.segmento || ""] || "#8b949e";
                        const nivelCor = NIVEL_COR[c.nivel || ""] || "#8b949e";
                        return (
                          <button
                            type="button"
                            key={c.slug}
                            onClick={() => setCargoSelecionado(c)}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                              textAlign: "left",
                              padding: 16,
                              borderRadius: 12,
                              cursor: "pointer",
                              background: "#161b22",
                              border: `2px solid ${ativo ? "#c9a24a" : "#30363d"}`,
                              transition: "border-color 150ms",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700 }}>{c.titulo}</span>
                                {c.nivel && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: "2px 7px",
                                      borderRadius: 20,
                                      background: nivelCor + "22",
                                      color: nivelCor,
                                      border: `1px solid ${nivelCor}44`,
                                    }}
                                  >
                                    {c.nivel}
                                  </span>
                                )}
                                {c.especialidade && (
                                  <span style={{ fontSize: 10, color: "#8b949e" }}>{c.especialidade}</span>
                                )}
                                {c.segmento && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: "2px 7px",
                                      borderRadius: 20,
                                      background: segCor + "22",
                                      color: segCor,
                                      border: `1px solid ${segCor}44`,
                                    }}
                                  >
                                    {c.segmento}
                                  </span>
                                )}
                              </div>
                              {c.descricao_curta && (
                                <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>{c.descricao_curta}</p>
                              )}
                            </div>
                            {ativo && <span style={{ color: "#c9a24a", fontSize: 16, flexShrink: 0 }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {passo === 2 && cargoSelecionado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Identidade do agente
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Campos fixos do cargo, nome e mercados.
                </p>
              </div>

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 12px" }}>
                  Fixo do cargo 🔒
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>
                      Nível
                    </label>
                    {cargoSelecionado.nivel ? (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: (NIVEL_COR[cargoSelecionado.nivel] || "#8b949e") + "22",
                          color: NIVEL_COR[cargoSelecionado.nivel] || "#8b949e",
                          border: `1px solid ${(NIVEL_COR[cargoSelecionado.nivel] || "#8b949e")}44`,
                        }}
                      >
                        {cargoSelecionado.nivel}
                      </span>
                    ) : (
                      <span style={{ color: "#8b949e", fontSize: 13 }}>—</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                    Inferência: <strong style={{ color: "#8b949e" }}>Mistral</strong> (Agno). Modelo efectivo em{" "}
                    <code style={{ fontSize: 11 }}>MISTRAL_MODEL</code> no servidor — sem escolha por agente.
                  </p>
                </div>
              </div>

              <div>
                <label
                  style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}
                >
                  Nome do agente <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Marina, SDR Apex, Analista Comercial..."
                  style={{
                    width: "100%",
                    background: "#161b22",
                    border: "1px solid #30363d",
                    color: "#e6edf3",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 10 }}
                >
                  Mercados
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {MERCADOS_FIXOS.map((m) => {
                    const sel = mercados.includes(m);
                    return (
                      <button type="button" key={m} onClick={() => toggleMercado(m)} style={chip(sel)}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {passo === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Personalidade
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Ajuste os 5 eixos para definir o estilo de comunicação do agente.
                </p>
              </div>

              {EIXOS.map((eixo, i) => (
                <div key={eixo.nome} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3" }}>{eixo.nome}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((v) => {
                      const ativo = valores[i] === v;
                      return (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setValor(i, v)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            border: `2px solid ${ativo ? "#c9a24a" : "#30363d"}`,
                            background: ativo ? "#c9a24a" : "#161b22",
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

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 8 }}>
                  RESULTADO
                </label>
                <pre
                  style={{
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 8,
                    padding: 14,
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "#8b949e",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {personalidadeGerada}
                </pre>
              </div>
            </div>
          )}

          {passo === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Conhecimento
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Preencha as secções que desejar — o agente usará estas informações. A primeira aba é um
                  esqueleto POP genérico (objetivo, triagem, escalação); adapte ao cargo, não só vendas.
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SECOES_CONHECIMENTO.map((s) => {
                  const temConteudo = !!conhecimento[s.id]?.trim();
                  const ativa = abaConhecimento === s.id;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setAbaConhecimento(s.id);
                        setErroIaConhecimento("");
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: `1px solid ${ativa ? "#c9a24a" : "#30363d"}`,
                        background: ativa ? "#c9a24a22" : "#161b22",
                        color: ativa ? "#c9a24a" : "#8b949e",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {s.label}
                      {temConteudo && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#c9a24a",
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {SECOES_CONHECIMENTO.filter((s) => s.id === abaConhecimento).map((s) => (
                <div key={s.id}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", margin: 0 }}>
                      {s.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => gerarSecaoComIa(s.id)}
                      disabled={
                        !!gerandoIaConhecimento ||
                        !cargoSelecionado ||
                        !nome.trim()
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor:
                          gerandoIaConhecimento || !cargoSelecionado || !nome.trim()
                            ? "not-allowed"
                            : "pointer",
                        border: "1px solid #238636",
                        background:
                          gerandoIaConhecimento || !cargoSelecionado || !nome.trim()
                            ? "#21262d"
                            : "#23863633",
                        color:
                          gerandoIaConhecimento || !cargoSelecionado || !nome.trim()
                            ? "#484f58"
                            : "#3fb950",
                        opacity:
                          gerandoIaConhecimento || !cargoSelecionado || !nome.trim() ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                      title={
                        !nome.trim()
                          ? "Indique o nome do agente no passo Identidade."
                          : "Gera esta secção com IA (contexto: cargo selecionado + nome agente)."
                      }
                    >
                      {gerandoIaConhecimento === s.id
                        ? "A gerar…"
                        : "✨ Gerar com IA"}
                    </button>
                  </div>
                  {erroIaConhecimento && abaConhecimento === s.id && (
                    <p style={{ color: "#f85149", fontSize: 12, margin: "0 0 8px" }}>{erroIaConhecimento}</p>
                  )}
                  <textarea
                    value={conhecimento[s.id] || ""}
                    onChange={(e) => setConhecimento((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder={s.placeholder}
                    rows={8}
                    style={{
                      width: "100%",
                      background: "#161b22",
                      border: "1px solid #30363d",
                      color: "#e6edf3",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 13,
                      outline: "none",
                      resize: "vertical",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {passo === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Revisão
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Confira tudo antes de criar o agente.
                </p>
              </div>

              {cargoSelecionado && (
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                  <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 6px" }}>CARGO SELECIONADO</p>
                  <p style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
                    {cargoSelecionado.titulo}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {cargoSelecionado.nivel && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: (NIVEL_COR[cargoSelecionado.nivel] || "#8b949e") + "22",
                          color: NIVEL_COR[cargoSelecionado.nivel] || "#8b949e",
                          border: `1px solid ${(NIVEL_COR[cargoSelecionado.nivel] || "#8b949e")}44`,
                        }}
                      >
                        {cargoSelecionado.nivel}
                      </span>
                    )}
                    {cargoSelecionado.segmento && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: (SEGMENTO_COR[cargoSelecionado.segmento] || "#8b949e") + "22",
                          color: SEGMENTO_COR[cargoSelecionado.segmento] || "#8b949e",
                          border: `1px solid ${(SEGMENTO_COR[cargoSelecionado.segmento] || "#8b949e")}44`,
                        }}
                      >
                        {cargoSelecionado.segmento}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
                {[
                  { label: "Nome", value: nome || "—" },
                  { label: "Mercados", value: mercados.join(", ") || "—" },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: "1px solid #30363d",
                    }}
                  >
                    <span style={{ color: "#8b949e", fontSize: 12 }}>{row.label}</span>
                    <span style={{ color: "#e6edf3", fontSize: 12, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 4px" }}>
                  QUANDO O AGENTE ATUA
                </p>
                <p style={{ color: "#6e7781", fontSize: 12, margin: "0 0 14px", lineHeight: 1.5 }}>
                  Defina primeiro o <strong style={{ color: "#aebccf" }}>tipo de operação</strong>. Agentes de
                  atendimento respondem no WhatsApp (webhook UAZAPI); agentes internos usam ciclos e cron no
                  hub.
                </p>

                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                  TIPO DE OPERAÇÃO
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {(
                    [
                      {
                        id: "canal_whatsapp" as const,
                        Icon: MessageSquare,
                        titulo: MODO_OPERACAO_LABEL.canal_whatsapp,
                        texto: MODO_OPERACAO_DESCRICAO.canal_whatsapp,
                      },
                      {
                        id: "jobs_internos" as const,
                        Icon: Zap,
                        titulo: MODO_OPERACAO_LABEL.jobs_internos,
                        texto: MODO_OPERACAO_DESCRICAO.jobs_internos,
                      },
                    ] as const
                  ).map((opt) => {
                    const Ico = opt.Icon;
                    const ativo = modoOperacao === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setModoOperacao(opt.id);
                          if (opt.id === "canal_whatsapp") setModoExecucao("interacao");
                          else if (modoExecucao === "interacao") setModoExecucao("agenda");
                        }}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          textAlign: "left",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: `1px solid ${ativo ? "#c9a24a88" : "#30363d"}`,
                          background: ativo ? "#c9a24a18" : "#0d1117",
                          cursor: "pointer",
                        }}
                      >
                        <Ico
                          size={20}
                          color={ativo ? "#c9a24a" : "#6e7781"}
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span>
                          <span
                            style={{
                              display: "block",
                              color: "#e6edf3",
                              fontWeight: 700,
                              fontSize: 13,
                              marginBottom: 4,
                            }}
                          >
                            {opt.titulo}
                          </span>
                          <span style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                            {opt.texto}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "provisionar" as const, label: "Criar ciclo do assistente" },
                      { id: "somente_vincular" as const, label: "Só associar existentes" },
                    ] as const
                  ).map((opt) => {
                    const at = hubCicloEstrategia === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setHubCicloEstrategia(opt.id)}
                        style={{
                          flex: "1 1 140px",
                          padding: "10px 12px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: `1px solid ${at ? "#c9a24a" : "#30363d"}`,
                          background: at ? "#c9a24a22" : "#0d1117",
                          color: at ? "#c9a24a" : "#8b949e",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {hubCicloEstrategia === "somente_vincular" ? (
                  <p style={{ color: "#c9a24a", fontSize: 11, margin: "0 0 12px", lineHeight: 1.5 }}>
                    Os ciclos escolhidos passam a usar o <strong>slug do novo agente</strong> e deixam de
                    contar para o agente anterior nesta tabela.
                  </p>
                ) : null}

                {hubCicloEstrategia === "provisionar" ? (
                  <>
                    {modoOperacao === "canal_whatsapp" ? (
                      <p
                        style={{
                          color: "#8b949e",
                          fontSize: 12,
                          margin: "0 0 12px",
                          lineHeight: 1.5,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid #30363d",
                          background: "#0d1117",
                        }}
                      >
                        Será criado um ciclo <strong style={{ color: "#c9a24a" }}>gatilho</strong> (sob
                        interação). A conversa ao vivo é acionada pelo webhook UAZAPI — não precisa de cron
                        para cada mensagem.
                      </p>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(
                        [
                          ...(modoOperacao === "canal_whatsapp"
                            ? ([
                                {
                                  id: "interacao" as const,
                                  Icon: Webhook,
                                  titulo: "Sob interação (WhatsApp)",
                                  texto:
                                    "Responde quando o cliente envia mensagem — padrão para atendimento no canal.",
                                },
                              ] as const)
                            : ([
                                {
                                  id: "tempo_real" as const,
                                  Icon: Zap,
                                  titulo: "Automático contínuo",
                                  texto:
                                    "Motor interno / relatórios — ciclo contínuo no hub (dispatch só trata programado).",
                                },
                                {
                                  id: "agenda" as const,
                                  Icon: Clock,
                                  titulo: "Agenda fixa",
                                  texto:
                                    "Ciclo programado (em pausa) com intervalo abaixo; configure dispatch e ative.",
                                },
                              ] as const)),
                        ] as const
                      ).map((opt) => {
                        const Ico = opt.Icon;
                        const ativo = modoExecucao === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setModoExecucao(opt.id)}
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
                              textAlign: "left",
                              padding: "12px 14px",
                              borderRadius: 10,
                              border: `1px solid ${ativo ? "#23863688" : "#30363d"}`,
                              background: ativo ? "#23863622" : "#0d1117",
                              cursor: "pointer",
                            }}
                          >
                            <Ico
                              size={20}
                              color={ativo ? "#3fb950" : "#6e7781"}
                              strokeWidth={2}
                              aria-hidden
                            />
                            <span>
                              <span
                                style={{
                                  display: "block",
                                  color: "#e6edf3",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  marginBottom: 4,
                                }}
                              >
                                {opt.titulo}
                              </span>
                              <span style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                                {opt.texto}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {modoExecucao === "agenda" ? (
                      <div style={{ marginTop: 14 }}>
                        <label
                          htmlFor="ciclo-intervalo-agenda"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#8b949e",
                            display: "block",
                            marginBottom: 8,
                          }}
                        >
                          REPETIR A CADA (minutos)
                        </label>
                        <select
                          id="ciclo-intervalo-agenda"
                          value={agendaIntervalMin}
                          onChange={(e) =>
                            setAgendaIntervalMin(Number(e.target.value) as 15 | 60 | 360 | 1440)
                          }
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            color: "#e6edf3",
                            fontSize: 13,
                          }}
                        >
                          <option value={15}>15 minutos</option>
                          <option value={60}>1 hora</option>
                          <option value={360}>6 horas</option>
                          <option value={1440}>≈ 1 vez por dia</option>
                        </select>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div style={{ marginTop: hubCicloEstrategia === "provisionar" ? 16 : 0 }}>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: 11,
                      fontWeight: 700,
                      margin: "0 0 8px",
                    }}
                  >
                    {hubCicloEstrategia === "somente_vincular"
                      ? "SELECIONAR CICLOS"
                      : "VINCULAR CICLOS EXISTENTES (OPCIONAL)"}
                  </p>
                  {hubCiclosCarregando ? (
                    <p style={{ color: "#6e7781", fontSize: 12, margin: 0 }}>A carregar ciclos…</p>
                  ) : hubCiclosLista.length === 0 ? (
                    <p style={{ color: "#6e7781", fontSize: 12, margin: 0 }}>
                      Nenhum ciclo em hub_ciclos_ia. Crie-os em CRM → Ciclos IA.
                    </p>
                  ) : (
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        borderRadius: 10,
                        border: "1px solid #30363d",
                        background: "#0d1117",
                      }}
                    >
                      {hubCiclosLista.map((c) => {
                        const marcado = hubCiclosVincularIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                              padding: "10px 12px",
                              borderBottom: "1px solid #21262d",
                              cursor: "pointer",
                              margin: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggleHubCicloVincular(c.id)}
                              style={{ marginTop: 3 }}
                            />
                            <span style={{ minWidth: 0 }}>
                              <span
                                style={{
                                  display: "block",
                                  color: "#e6edf3",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {c.nome || "—"}
                              </span>
                              <span style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.45 }}>
                                {c.agente_slug} · {hubCicloTipoLabel(c.tipo)}
                                {!c.ativo ? " · inativo" : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>PERSONALIDADE</p>
                <pre
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "#8b949e",
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {personalidadeGerada.slice(0, 300)}
                  {personalidadeGerada.length > 300 ? "..." : ""}
                </pre>
              </div>

              {SECOES_CONHECIMENTO.filter((s) => conhecimento[s.id]?.trim()).length > 0 && (
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
                  <p
                    style={{
                      color: "#8b949e",
                      fontSize: 11,
                      fontWeight: 700,
                      margin: 0,
                      padding: "12px 16px",
                      borderBottom: "1px solid #30363d",
                    }}
                  >
                    CONHECIMENTO
                  </p>
                  {SECOES_CONHECIMENTO.filter((s) => conhecimento[s.id]?.trim()).map((s) => (
                    <div key={s.id} style={{ padding: "10px 16px", borderBottom: "1px solid #30363d" }}>
                      <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 4px" }}>{s.label}</p>
                      <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                        {conhecimento[s.id].slice(0, 100)}
                        {conhecimento[s.id].length > 100 ? "..." : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {erro && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: 13,
                    background: "#ef444411",
                    border: "1px solid #ef444433",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  {erro}
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={!cargoSelecionado || !nome.trim()}
                style={{
                  padding: "14px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor: !cargoSelecionado || !nome.trim() ? "not-allowed" : "pointer",
                  opacity: !cargoSelecionado || !nome.trim() ? 0.4 : 1,
                }}
              >
                Criar agente
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            {passo > 1 && (
              <button
                type="button"
                onClick={() => setPasso((p) => p - 1)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "transparent",
                  border: "1px solid #30363d",
                  color: "#8b949e",
                  cursor: "pointer",
                }}
              >
                ← Anterior
              </button>
            )}
            {passo < 5 && (
              <button
                type="button"
                onClick={() => setPasso((p) => p + 1)}
                disabled={passo === 1 ? !cargoSelecionado : passo === 2 ? !nome.trim() : false}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor:
                    (passo === 1 && !cargoSelecionado) || (passo === 2 && !nome.trim())
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    (passo === 1 && !cargoSelecionado) || (passo === 2 && !nome.trim()) ? 0.4 : 1,
                }}
              >
                Próximo →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
