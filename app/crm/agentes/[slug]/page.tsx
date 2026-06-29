"use client";
import dynamic from "next/dynamic";
import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowLeft,
  BookOpen,
  Plug,
  Settings2,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { isEmailChannelEnabledClient } from "@/lib/feature-flags";
import { AgenteAvatar } from "@/components/crm/AgenteAvatar";
import { AgenteCiclosOperacaoList } from "@/components/crm/AgenteCiclosOperacaoList";
import { AgenteFollowupPanel } from "@/components/crm/AgenteFollowupPanel";
import { AgentePerformancePanel } from "@/components/crm/AgentePerformancePanel";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT, crmBtnPrimary, crmInfoBox } from "@/lib/crm/crm-button-styles";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { AgentePersonalidadeEixosPanel } from "@/components/crm/AgentePersonalidadeEixosPanel";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { diasSemanaParaGravacao, diasSemanaParaUi } from "@/lib/hub/agente-dias-semana";
import {
  AgenteFerramentasIaBlock,
  type CatalogoFerramentaCustomLite,
  type CatalogoFerramentaExternaLite,
  type CatalogoFerramentaIntegradorLite,
} from "@/components/crm/AgenteFerramentasIaBlock";
import { fetchHubFerramentasExternas } from "@/lib/hub/fetch-hub-ferramentas-externas";
import type { IntegradorCatalogoEntry } from "@/lib/hub/integradores-catalogo";
import type { FollowupOperacaoSnapshot } from "@/lib/hub/followup-operacao";
import {
  AgenteEmailConnectBlock,
  type AgenteEmailSnapshot,
} from "@/components/crm/AgenteEmailConnectBlock";
import { AgenteUazapiBlock, type AgenteUazapiSnapshot } from "@/components/crm/AgenteUazapiBlock";
import { AgenteFollowupBlock } from "@/components/crm/AgenteFollowupBlock";
import { AgenteGoogleWorkspaceBlock } from "@/components/crm/AgenteGoogleWorkspaceBlock";
import { GestorWhatsappIntegracaoBlock } from "@/components/crm/GestorWhatsappIntegracaoBlock";
import { AgenteMem0Block } from "@/components/crm/AgenteMem0Block";
import { MEM0_FERRAMENTA_KEYS } from "@/lib/hub/mem0-constants";
import { buildGoogleIntegradorCatalogLite } from "@/lib/hub/agente-wizard-google";
import { agenteEhModoCanal, type ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { hubModeloExibicaoProduto } from "@/lib/ia/hub-model-defaults";
import {
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import { gerarPersonalidadeAgente, parsearValoresPersonalidade } from "@/lib/hub/agente-personalidade-eixos";
import { MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";
import { mensagemErroHubAgente } from "@/lib/hub/agente-hub-errors";

/** Drawers pesados (playbook + React Flow) em chunks separados — evita ChunkLoadError no dev. */
const AgenteBriefingDrawer = dynamic(
  () =>
    import("@/components/crm/AgenteBriefingChatPanel").then((m) => ({
      default: m.AgenteBriefingDrawer,
    })),
  { ssr: false }
);

const AgentePlaybookCalibracaoDrawer = dynamic(
  () =>
    import("@/components/crm/AgentePlaybookCalibracaoDrawer").then((m) => ({
      default: m.AgentePlaybookCalibracaoDrawer,
    })),
  { ssr: false }
);

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nivelTag(nivel: string | number | undefined): string {
  if (nivel === undefined || nivel === null) return "";
  return typeof nivel === "number" ? `N${nivel}` : nivel;
}

type Agente = {
  agente_slug: string;
  nome: string;
  cargo?: string;
  area?: string;
  nivel?: string | number;
  modelo_padrao?: string;
  modelo_efetivo?: string;
  prefixo_mercado?: string;
  personalidade?: string;
  bio?: string;
  tom_voz?: string;
  estilo_comunicacao?: string;
  system_prompt_base?: string;
  horario_inicio?: string;
  horario_fim?: string;
  dias_semana?: number[] | string[];
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
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const { success: toastSuccess } = useCrmToast();

  const [agente, setAgente] = useState<Agente | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Campos editáveis
  const [nome, setNome] = useState("");
  const [valores, setValores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("22:00");
  const [diasSemana, setDiasSemana] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const [bio, setBio] = useState("");
  const [tomVoz, setTomVoz] = useState("");
  const [estiloComunicacao, setEstiloComunicacao] = useState("");
  const [systemPromptBase, setSystemPromptBase] = useState("");

  const [motorFerramentasHub, setMotorFerramentasHub] = useState(false);
  const [mistralProvisionar, setMistralProvisionar] = useState(false);
  const [usoFerramentasIa, setUsoFerramentasIa] = useState<Record<string, boolean>>(() =>
    mergeUsoFerramentasComPadraoPreservandoCustom({})
  );
  const [catalogoCustomFerramentas, setCatalogoCustomFerramentas] = useState<CatalogoFerramentaCustomLite[]>([]);
  const [catalogoExternaFerramentas, setCatalogoExternaFerramentas] = useState<CatalogoFerramentaExternaLite[]>([]);
  const [catalogoIntegradorFerramentas, setCatalogoIntegradorFerramentas] = useState<
    CatalogoFerramentaIntegradorLite[]
  >([]);
  const [syncMistralLoading, setSyncMistralLoading] = useState(false);

  // UI state
  const [showArquivar, setShowArquivar] = useState(false);
  const [motivoArquivamento, setMotivoArquivamento] = useState("");
  const [arquivando, setArquivando] = useState(false);
  const [showConfirmSalvar, setShowConfirmSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [calibracaoOpen, setCalibracaoOpen] = useState(false);
  const [showLimparMemorias, setShowLimparMemorias] = useState(false);
  const [limpandoMemorias, setLimpandoMemorias] = useState(false);
  const [contagemMemorias, setContagemMemorias] = useState<{
    memorias: number;
    briefingSessoes: number;
    leads: number;
    memoriasLead: number;
  } | null>(null);
  const [incluirBriefingAoLimpar, setIncluirBriefingAoLimpar] = useState(true);

  type OperacaoPayload = {
    ciclos: Record<string, unknown>[];
    execucoes_ciclo: Record<string, unknown>[];
    acoes: Record<string, unknown>[];
    ultimo_prompt_em: string | null;
    followup?: FollowupOperacaoSnapshot | null;
  };
  const [operacao, setOperacao] = useState<OperacaoPayload | null>(null);
  const [operacaoLoading, setOperacaoLoading] = useState(false);
  const [operacaoAtualizadoEm, setOperacaoAtualizadoEm] = useState<number | null>(null);

  type AbaFichaAgente = "geral" | "personalidade" | "integracoes" | "followups" | "operacao";
  const [abaFicha, setAbaFicha] = useState<AbaFichaAgente>("geral");

  const carregar = useCallback(async () => {
    if (!slug) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/hub/agentes/${slug}`, { headers: await hubApiHeaders() });
      if (res.ok) {
        const data = (await res.json()) as Agente;
        setAgente(data);
        // Popular campos editáveis
        setNome(data.nome || "");
        setValores(parsearValoresPersonalidade(data.personalidade || ""));
        setHorarioInicio(data.horario_inicio || "08:00");
        setHorarioFim(data.horario_fim || "22:00");
        setDiasSemana(diasSemanaParaUi(data.dias_semana));
        setBio(data.bio || "");
        setTomVoz(data.tom_voz || "");
        setEstiloComunicacao(data.estilo_comunicacao || "");
        setSystemPromptBase(data.system_prompt_base || "");
        setMotorFerramentasHub(data.motor_ferramentas_habilitado === true);
        setMistralProvisionar(data.mistral_agent_sync_habilitado === true);
        setUsoFerramentasIa(
          mergeUsoFerramentasComPadraoPreservandoCustom(data.uso_ferramentas_ia)
        );
      }
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  }, [slug]);

  const carregarIntegradoresCatalogo = useCallback(async () => {
    try {
      const headers = await hubApiHeaders();
      const resInt = await fetch("/api/hub/integradores", { headers }).catch(() => null);
      if (!resInt?.ok) return;
      const j = (await resInt.json()) as {
        catalogo?: IntegradorCatalogoEntry[];
        conexoes?: Record<string, { configurado?: boolean; plataforma_ok?: boolean }>;
      };
      const lista: CatalogoFerramentaIntegradorLite[] = [];
      for (const entry of j.catalogo ?? []) {
        if (j.conexoes?.[entry.id]?.configurado !== true) continue;
        for (const f of entry.ferramentas) {
          lista.push({
            ferramenta_key: f.ferramenta_key,
            titulo: f.titulo,
            integrador_nome: entry.nome,
            politica: f.politica,
            descricao_curta: f.descricao_curta ?? null,
          });
        }
      }
      setCatalogoIntegradorFerramentas(lista);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await hubApiHeaders();
        const [r, externas] = await Promise.all([
          fetch("/api/hub/ferramentas-custom?all=true", { headers }),
          fetchHubFerramentasExternas(headers, false).catch(() => []),
        ]);
        const d: unknown = await r.json().catch(() => null);
        if (r.ok && Array.isArray(d)) {
          setCatalogoCustomFerramentas(
            (d as Record<string, unknown>[]).map((x) => ({
              ferramenta_key: String(x.ferramenta_key ?? ""),
              titulo: String(x.titulo ?? ""),
              builtin_impl: String(x.builtin_impl ?? ""),
              smart_provider: String(x.smart_provider ?? "none"),
              ativo: x.ativo !== false,
              descricao_curta:
                x.descricao_curta != null && String(x.descricao_curta).trim()
                  ? String(x.descricao_curta).trim()
                  : null,
            }))
          );
        }
        setCatalogoExternaFerramentas(
          externas.map((x) => ({
            ferramenta_key: x.ferramenta_key,
            titulo: x.titulo,
            metodo_http: x.metodo_http,
            politica: x.politica,
            ativo: x.ativo !== false,
            descricao_curta: x.descricao_curta ?? null,
          }))
        );
        await carregarIntegradoresCatalogo();
      } catch {
        /* ignore */
      }
    })();
  }, [carregarIntegradoresCatalogo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarOperacao = useCallback(
    async (silent = false) => {
      if (!slug) return;
      if (!silent) setOperacaoLoading(true);
      try {
        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/operacao`, {
          headers: await hubApiHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as OperacaoPayload;
        setOperacao(data);
        setOperacaoAtualizadoEm(Date.now());
      } catch {
        /* métricas opcionais */
      } finally {
        if (!silent) setOperacaoLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    void carregarOperacao();
  }, [carregarOperacao]);

  useEffect(() => {
    if ((abaFicha !== "followups" && abaFicha !== "operacao") || !slug) return;
    const id = window.setInterval(() => {
      void carregarOperacao(true);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [abaFicha, slug, carregarOperacao]);

  useEffect(() => {
    const oauth = searchParams.get("google_oauth");
    if (oauth === "connected" || oauth === "error") {
      setAbaFicha("integracoes");
    }
    const aba = searchParams.get("aba");
    if (
      aba === "integracoes" ||
      aba === "geral" ||
      aba === "personalidade" ||
      aba === "followups" ||
      aba === "operacao"
    ) {
      setAbaFicha(aba);
    }
  }, [searchParams]);

  const avatarUrl = useMemo(() => {
    const v = agente?.avatar_url;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }, [agente?.avatar_url]);

  const integradorCatalogFicha = useMemo(() => {
    const mem0Keys = new Set<string>(MEM0_FERRAMENTA_KEYS);
    const keys = new Set(catalogoIntegradorFerramentas.map((x) => x.ferramenta_key));
    const pendentesGoogle = buildGoogleIntegradorCatalogLite({ requerConexao: true }).filter(
      (x) => !keys.has(x.ferramenta_key)
    );
    return [...catalogoIntegradorFerramentas, ...pendentesGoogle].filter(
      (x) => !mem0Keys.has(x.ferramenta_key)
    );
  }, [catalogoIntegradorFerramentas]);

  const agenteModoCanal = agente
    ? agenteEhModoCanal(agente.modo_operacao as ModoOperacaoAgente)
    : false;

  function toggleDia(d: number) {
    setDiasSemana((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  async function abrirModalLimparMemorias() {
    setShowLimparMemorias(true);
    setContagemMemorias(null);
    setIncluirBriefingAoLimpar(true);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/memorias`, {
        headers: await hubApiHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          memorias?: number;
          briefingSessoes?: number;
          leads?: number;
          memoriasLead?: number;
        };
        setContagemMemorias({
          memorias: typeof data.memorias === "number" ? data.memorias : 0,
          briefingSessoes: typeof data.briefingSessoes === "number" ? data.briefingSessoes : 0,
          leads: typeof data.leads === "number" ? data.leads : 0,
          memoriasLead: typeof data.memoriasLead === "number" ? data.memoriasLead : 0,
        });
      }
    } catch {
      /* contagem opcional */
    }
  }

  async function confirmarLimparMemorias() {
    setLimpandoMemorias(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/memorias`, {
        method: "DELETE",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ incluir_briefing: incluirBriefingAoLimpar }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        memoriasRemovidas?: number;
        briefingSessoesRemovidas?: number;
        leadsResetados?: number;
        memoriasLeadRemovidas?: number;
      };
      if (!res.ok) {
        setErro(data.error || "Não foi possível limpar as memórias.");
        setShowLimparMemorias(false);
        return;
      }
      const nMem = data.memoriasRemovidas ?? 0;
      const nBrief = data.briefingSessoesRemovidas ?? 0;
      const nLeads = data.leadsResetados ?? 0;
      const nMemLead = data.memoriasLeadRemovidas ?? 0;
      toastSuccess(
        `Reset completo: ${nMem} memória(s) do agente${incluirBriefingAoLimpar ? `, ${nBrief} sessão(ões) de briefing` : ""}, ${nLeads} lead(s) com fluxo WhatsApp zerado (${nMemLead} memória(s) de lead).`,
      );
      setShowLimparMemorias(false);
    } catch {
      setErro("Falha de rede ao limpar memórias.");
    } finally {
      setLimpandoMemorias(false);
    }
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
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoArquivamento.trim() }),
      });
      if (res.ok) {
        router.push("/crm/agentes");
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string };
        setErro(mensagemErroHubAgente(data.erro || "Falha ao arquivar."));
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
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          prefixo_mercado: MERCADO_PREFIXO_PADRAO,
          personalidade: gerarPersonalidadeAgente(valores),
          horario_inicio: horarioInicio,
          horario_fim: horarioFim,
          dias_semana: diasSemanaParaGravacao(diasSemana),
          bio,
          tom_voz: tomVoz,
          estilo_comunicacao: estiloComunicacao,
          system_prompt_base: systemPromptBase,
          motor_ferramentas_habilitado: motorFerramentasHub,
          mistral_agent_sync_habilitado: mistralProvisionar,
          uso_ferramentas_ia: usoFerramentasIa,
        }),
      });
      if (res.ok) {
        toastSuccess("Alterações salvas com sucesso.");
        setShowConfirmSalvar(false);
        await carregar();
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string; error?: string };
        setErro(mensagemErroHubAgente(data.erro || data.error || "Erro ao salvar."));
        setShowConfirmSalvar(false);
      }
    } catch {
      setErro("Falha na requisição.");
      setShowConfirmSalvar(false);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoAgente() {
    if (!agente || agente.arquivado_em) return;
    const proximo = agente.ativo === false;
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${slug}`, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: proximo }),
      });
      if (res.ok) {
        toastSuccess(proximo ? "Agente ativado" : "Agente desativado");
        await carregar();
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string; error?: string };
        setErro(mensagemErroHubAgente(data.erro || data.error || "Não foi possível alterar o estado."));
      }
    } catch {
      setErro("Falha de rede ao alterar estado.");
    }
  }

  async function sincronizarMistralAgora() {
    if (!agente) return;
    setSyncMistralLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${slug}/mistral-sync`, {
        method: "POST",
        headers: await hubApiHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mistral_agent_id?: string };
      if (res.ok) {
        toastSuccess("Agent Mistral sincronizado");
        await carregar();
      } else {
        setErro(data.error || "Falha ao sincronizar com Mistral.");
      }
    } catch {
      setErro("Falha na requisição de sync Mistral.");
    } finally {
      setSyncMistralLoading(false);
    }
  }

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fcf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando agente...</p>
      </div>
    );
  }

  if (!agente) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fcf6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: "#5d7a67", fontSize: 13 }}>Agente não encontrado.</p>
        <button
          onClick={() => router.push("/crm/agentes")}
          style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: "#ffffff", border: "1px solid #dcebd8", color: "#5d7a67", cursor: "pointer",
          }}
        >
          ← Voltar para agentes
        </button>
      </div>
    );
  }

  const segCor = SEGMENTO_COR[agente.area || ""] || "#5d7a67";
  const nivelCor = NIVEL_COR[nivelTag(agente.nivel)] || "#5d7a67";
  const statusBadge = badgeStatusAgente(agente);

  const chipStyle = (ativo: boolean, clicavel = true): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: clicavel ? "pointer" : "default",
    border: `1px solid ${ativo ? CRM_ACCENT : "#d4ecd0"}`,
    background: ativo ? "#3f984818" : "#ffffff",
    color: ativo ? CRM_ACCENT : BRAND_TEXT_DARK,
    transition: "all 150ms",
  });

  const inputStyle: React.CSSProperties = {
    background: "#f8fcf6", border: "1px solid #dcebd8", color: "#0b2210",
    borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none",
    width: "100%", boxSizing: "border-box",
  };

  const inputDisabledStyle: React.CSSProperties = {
    ...inputStyle,
    color: "#3d5c48",
    cursor: "not-allowed",
    opacity: 0.85,
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#3d5c48",
    fontWeight: 700,
    display: "block",
    marginBottom: 4,
  };

  const labelSectionStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.8,
    color: "#2d4a38",
    textTransform: "uppercase",
  };

  const cardShell: CSSProperties = {
    background: "#ffffff",
    border: "1px solid rgba(18, 56, 43, 0.12)",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15, 56, 39, 0.05)",
  };

  const sectionHeadingStyle: CSSProperties = {
    color: "#6b8a76",
    fontSize: 11,
    fontWeight: 800,
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  };

  const botaoSalvar = (
    <button
      type="button"
      onClick={() => setShowConfirmSalvar(true)}
      style={{ ...crmBtnPrimary(), width: "100%", padding: "12px 0", fontSize: 13, marginTop: 8 }}
    >
      Salvar alterações
    </button>
  );

  const cicloCount = operacao?.ciclos?.length ?? 0;
  const followupCount = operacao?.followup?.envios_24h ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "#f8fcf6" }}>

      {/* HEADER — permanece visível; scroll só no painel da aba */}
      <div
        style={{
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid rgba(18, 56, 43, 0.14)",
          boxShadow: "0 4px 24px rgba(15, 56, 39, 0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "14px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Voltar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid #dcebd8",
                background: "#eef7eb",
                color: BRAND_TEXT_DARK,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <AgenteAvatar
              seed={agente.agente_slug}
              nome={agente.nome}
              imageUrl={avatarUrl}
              size={64}
              shape="circle"
              status={
                agente.arquivado_em ? "arquivado" : agente.ativo === false ? "inativo" : "ativo"
              }
              alt={agente.nome}
            />
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  color: BRAND_TEXT_DARK,
                  fontSize: 22,
                  fontWeight: 800,
                  margin: "0 0 6px",
                  letterSpacing: -0.3,
                }}
              >
                {agente.nome}
              </h1>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#3d5c48",
                  fontWeight: 600,
                }}
              >
                {agente.ativo !== false && !agente.arquivado_em ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: CRM_ACCENT,
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: BRAND_GREEN_BRIGHT,
                        boxShadow: `0 0 6px ${BRAND_GREEN_BRIGHT}`,
                      }}
                    />
                    Ativo
                  </span>
                ) : (
                  <span style={{ fontWeight: 700, color: statusBadge.fg }}>{statusBadge.label}</span>
                )}
                <span style={{ color: "#b8d4bc", fontWeight: 400 }}>|</span>
                <span style={{ color: "#2d4a38" }}>{agente.cargo}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0, minWidth: 0 }}>
            {erro ? (
              <span
                style={{
                  fontSize: 11,
                  color: "#ef4444",
                  maxWidth: 420,
                  textAlign: "right",
                  lineHeight: 1.45,
                }}
              >
                {erro}
              </span>
            ) : null}
            <HeaderActionGroup aria-label="Ações do agente">
              {!agente.arquivado_em ? (
                <HeaderActionButton
                  icon={null}
                  label={agente.ativo !== false ? "Desativar Agente" : "Ativar Agente"}
                  onClick={() => void alternarAtivoAgente()}
                  variant={agente.ativo !== false ? "danger" : "accent"}
                  position="middle"
                />
              ) : null}
              <HeaderActionButton
                icon={<Sparkles size={15} />}
                label="Briefing IA"
                onClick={() => setBriefingOpen(true)}
                variant="accent"
                position="middle"
              />
              <HeaderActionButton
                icon={<BookOpen size={15} />}
                label="Playbook — Calibração"
                onClick={() => setCalibracaoOpen(true)}
                variant="accent"
                position="middle"
              />
              <HeaderActionButton
                icon={<Trash2 size={15} />}
                label="Limpar memórias"
                onClick={() => void abrirModalLimparMemorias()}
                variant="default"
                position="middle"
                title="Apaga memórias operacionais do agente (testes)"
              />
              <HeaderActionButton
                icon={<Archive size={15} />}
                label="Arquivar"
                onClick={() => {
                  setShowArquivar(true);
                  setMotivoArquivamento("");
                }}
                variant="default"
                position="last"
              />
            </HeaderActionGroup>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CrmStickyTabs
          variant="light"
          equalColumns
          activeId={abaFicha}
          onChange={(id) => setAbaFicha(id as AbaFichaAgente)}
          style={{ position: "relative", top: 0, zIndex: 10 }}
          tabs={[
            { id: "geral", label: "Geral", icon: Settings2 },
            { id: "personalidade", label: "Personalidade", icon: SlidersHorizontal },
            { id: "integracoes", label: "Integrações", icon: Plug },
            { id: "followups", label: `Follow-ups (${followupCount})`, icon: Send },
            { id: "operacao", label: `Operação (${cicloCount})`, icon: Activity },
          ]}
        />

        <div
          role="tabpanel"
          aria-labelledby={`crm-tab-${abaFicha}`}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              padding: "24px 32px 40px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {abaFicha === "geral" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ ...crmInfoBox(), marginBottom: 0 }}>
                  <p style={{ margin: 0 }}>
                    Cargo, área e nível são definidos na criação do agente.
                  </p>
                </div>

                <div style={{ ...cardShell, display: "flex", flexDirection: "column", gap: 16 }}>
                  <h2 style={sectionHeadingStyle}>Configurações fixas</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle}>Cargo</label>
                <input
                  value={agente.cargo || "—"}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
              <div>
                <label style={fieldLabelStyle}>Área</label>
                <input
                  value={agente.area || "—"}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
              <div>
                <label style={fieldLabelStyle}>Nível</label>
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
                <label style={fieldLabelStyle}>Modelo</label>
                <input
                  value={
                    typeof agente.modelo_efetivo === "string" && agente.modelo_efetivo.trim()
                      ? agente.modelo_efetivo
                      : hubModeloExibicaoProduto(agente.modelo_padrao)
                  }
                  disabled
                  style={inputDisabledStyle}
                />
              </div>
            </div>
                </div>

                <div style={{ ...cardShell, display: "flex", flexDirection: "column", gap: 20 }}>
                  <h2 style={sectionHeadingStyle}>Configurações editáveis</h2>

          {/* Nome */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 }}>
              Nome
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Horário */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 10 }}>
              Horário de atendimento
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              />
              <span style={{ color: "#5d7a67", fontSize: 13 }}>até</span>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 10 }}>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 }}>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 }}>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 }}>
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
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0b2210", display: "block", marginBottom: 8 }}>
              System prompt base
            </label>
            <textarea
              value={systemPromptBase}
              onChange={(e) => setSystemPromptBase(e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

                  {botaoSalvar}
                </div>
              </div>
            ) : null}

            {abaFicha === "personalidade" ? (
              <div style={{ ...cardShell, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h2 style={{ ...sectionHeadingStyle, marginBottom: 8 }}>Personalidade</h2>
                  <p style={{ fontSize: 12, color: "#3d5c48", margin: 0, lineHeight: 1.5 }}>
                    Ajuste os cinco eixos de comportamento. O texto gerado entra no prompt do agente ao salvar.
                  </p>
                </div>
                <AgentePersonalidadeEixosPanel
                  valores={valores}
                  onChange={setValor}
                  mostrarResultado
                  theme="light"
                />
                {botaoSalvar}
              </div>
            ) : null}

            {abaFicha === "integracoes" ? (
              <div style={{ ...cardShell, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <h2 style={{ ...sectionHeadingStyle, marginBottom: 8 }}>Integrações</h2>
                  <p style={{ fontSize: 12, color: "#3d5c48", margin: 0, lineHeight: 1.5 }}>
                    {agente.modo_operacao === "jobs_internos"
                      ? "WhatsApp com o mesmo fluxo dos externos (linha única da empresa). Gmail/Calendar e ferramentas são deste agente."
                      : `Canal de atendimento (WhatsApp${isEmailChannelEnabledClient() ? " ou e-mail" : ""}) e ferramentas disponíveis para este agente.`}
                  </p>
                </div>
                {agente.modo_operacao === "jobs_internos" ? (
                  <GestorWhatsappIntegracaoBlock agenteSlug={slug} agenteNome={agente.nome} />
                ) : null}
                {agente.modo_operacao === "canal_whatsapp" ? (
                  <>
                  <AgenteUazapiBlock
                    agenteSlug={slug}
                    agenteNome={agente.nome}
                    snapshot={{
                      uazapi_instance_id:
                        typeof agente.uazapi_instance_id === "string" ? agente.uazapi_instance_id : null,
                      uazapi_instance_name:
                        typeof agente.uazapi_instance_name === "string" ? agente.uazapi_instance_name : null,
                      uazapi_connection_status:
                        typeof agente.uazapi_connection_status === "string"
                          ? agente.uazapi_connection_status
                          : null,
                      uazapi_has_instance_token: agente.uazapi_has_instance_token === true,
                      uazapi_proxy_country:
                        typeof agente.uazapi_proxy_country === "string" ? agente.uazapi_proxy_country : null,
                      uazapi_proxy_state:
                        typeof agente.uazapi_proxy_state === "string" ? agente.uazapi_proxy_state : null,
                      uazapi_proxy_city:
                        typeof agente.uazapi_proxy_city === "string" ? agente.uazapi_proxy_city : null,
                    }}
                    onSnapshotPatch={(patch: Partial<AgenteUazapiSnapshot>) => {
                      setAgente((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          ...(patch.uazapi_instance_id !== undefined && {
                            uazapi_instance_id: patch.uazapi_instance_id,
                          }),
                          ...(patch.uazapi_instance_name !== undefined && {
                            uazapi_instance_name: patch.uazapi_instance_name,
                          }),
                          ...(patch.uazapi_connection_status !== undefined && {
                            uazapi_connection_status: patch.uazapi_connection_status,
                          }),
                          ...(patch.uazapi_has_instance_token !== undefined && {
                            uazapi_has_instance_token: patch.uazapi_has_instance_token,
                          }),
                          ...(patch.uazapi_proxy_country !== undefined && {
                            uazapi_proxy_country: patch.uazapi_proxy_country,
                          }),
                          ...(patch.uazapi_proxy_state !== undefined && {
                            uazapi_proxy_state: patch.uazapi_proxy_state,
                          }),
                          ...(patch.uazapi_proxy_city !== undefined && {
                            uazapi_proxy_city: patch.uazapi_proxy_city,
                          }),
                        };
                      });
                    }}
                  />
                  <AgenteFollowupBlock agenteSlug={slug} agenteNome={agente.nome} />
                  </>
                ) : null}
                {isEmailChannelEnabledClient() && agente.modo_operacao === "canal_email" ? (
                  <AgenteEmailConnectBlock
                    agenteSlug={slug}
                    agenteNome={agente.nome}
                    snapshot={{
                      email_from: typeof agente.email_from === "string" ? agente.email_from : null,
                      email_from_name:
                        typeof agente.email_from_name === "string" ? agente.email_from_name : null,
                      email_inbound: typeof agente.email_inbound === "string" ? agente.email_inbound : null,
                      email_ativo: agente.email_ativo !== false,
                    }}
                    onSnapshotPatch={(patch: Partial<AgenteEmailSnapshot>) => {
                      setAgente((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          ...(patch.email_from !== undefined && { email_from: patch.email_from }),
                          ...(patch.email_from_name !== undefined && {
                            email_from_name: patch.email_from_name,
                          }),
                          ...(patch.email_inbound !== undefined && { email_inbound: patch.email_inbound }),
                          ...(patch.email_ativo !== undefined && { email_ativo: patch.email_ativo }),
                        };
                      });
                    }}
                  />
                ) : null}
                {agenteModoCanal || agente.modo_operacao === "jobs_internos" ? (
                  <AgenteGoogleWorkspaceBlock
                    agenteSlug={slug}
                    agenteNome={agente.nome}
                    layout="card"
                    theme="light"
                    contexto="agendamento"
                    usoFerramentas={usoFerramentasIa}
                    returnToPath={`/crm/agentes/${encodeURIComponent(slug)}?google_oauth=connected`}
                    onUsoSynced={(patch) =>
                      setUsoFerramentasIa((prev) => ({
                        ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                        ...patch,
                      }))
                    }
                  />
                ) : null}
                {agenteModoCanal ? (
                  <AgenteMem0Block
                    agenteSlug={slug}
                    agenteNome={agente.nome}
                    layout="card"
                    usoFerramentas={usoFerramentasIa}
                    onUsoChange={(id, ativo) =>
                      setUsoFerramentasIa((prev) => ({
                        ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                        [id]: ativo,
                      }))
                    }
                  />
                ) : null}
                <AgenteFerramentasIaBlock
                  motorHabilitado={motorFerramentasHub}
                  onMotorChange={setMotorFerramentasHub}
                  mistralSyncHabilitado={mistralProvisionar}
                  onMistralSyncChange={setMistralProvisionar}
                  usoFerramentas={usoFerramentasIa}
                  onUsoChange={(id, ativo) =>
                    setUsoFerramentasIa((prev) => ({
                      ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                      [id]: ativo,
                    }))
                  }
                  customCatalog={catalogoCustomFerramentas}
                  externaCatalog={catalogoExternaFerramentas}
                  integradorCatalog={integradorCatalogFicha}
                  mistralAgentId={typeof agente.mistral_agent_id === "string" ? agente.mistral_agent_id : null}
                  mistralSyncEm={typeof agente.mistral_agent_sync_em === "string" ? agente.mistral_agent_sync_em : null}
                  mistralSyncErro={
                    typeof agente.mistral_agent_sync_erro === "string" ? agente.mistral_agent_sync_erro : null
                  }
                  destacarWhatsApp={
                    agente.modo_operacao === "canal_whatsapp" ||
                    (isEmailChannelEnabledClient() && agente.modo_operacao === "canal_email")
                  }
                  modoInterno={agente.modo_operacao === "jobs_internos"}
                />
                <button
                  type="button"
                  onClick={sincronizarMistralAgora}
                  disabled={syncMistralLoading || !mistralProvisionar}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: mistralProvisionar && !syncMistralLoading ? "pointer" : "not-allowed",
                    border: "1px solid #dcebd8",
                    background: mistralProvisionar ? "#ffffff" : "#f8fcf6",
                    color: mistralProvisionar ? CRM_ACCENT : "#484f58",
                  }}
                >
                  {syncMistralLoading ? "A sincronizar…" : "Sincronizar agora"}
                </button>
                {botaoSalvar}
              </div>
            ) : null}

            {abaFicha === "followups" ? (
              <AgenteFollowupPanel
                followup={operacao?.followup}
                loading={operacaoLoading}
                atualizadoEm={operacaoAtualizadoEm}
                onRefresh={() => void carregarOperacao()}
              />
            ) : null}

            {abaFicha === "operacao" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 24,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    ...cardShell,
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                    <h3 style={labelSectionStyle}>Ciclos atribuídos ({cicloCount})</h3>
                    <button
                      type="button"
                      onClick={() => router.push(`/crm/ciclos?q=${encodeURIComponent(slug)}`)}
                      style={{
                        border: "1px solid rgba(146, 255, 0, 0.45)",
                        background: "rgba(146, 255, 0, 0.12)",
                        color: "#1a5c32",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Ciclos IA
                    </button>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {operacaoLoading ? (
                      <p style={{ margin: 0, fontSize: 12, color: "#4a6356", fontWeight: 500 }}>A carregar ciclos…</p>
                    ) : (
                      <AgenteCiclosOperacaoList
                        ciclos={operacao?.ciclos ?? []}
                        theme="light"
                        mostrarDescricao={false}
                      />
                    )}
                  </div>
                </div>
                <AgentePerformancePanel
                  agenteSlug={slug}
                  ativo={agente.ativo !== false}
                  arquivado={!!agente.arquivado_em}
                  operacao={operacao}
                  operacaoLoading={operacaoLoading}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {briefingOpen ? (
        <AgenteBriefingDrawer
          open
          onClose={() => setBriefingOpen(false)}
          agenteSlug={slug}
          agenteNome={agente.nome}
          agenteCargo={typeof agente.cargo === "string" ? agente.cargo : null}
          modoOperacao={
            typeof agente.modo_operacao === "string" ? agente.modo_operacao : null
          }
        />
      ) : null}
      {calibracaoOpen ? (
        <AgentePlaybookCalibracaoDrawer
          open
          onClose={() => setCalibracaoOpen(false)}
          agenteSlug={slug}
          agenteNome={agente.nome}
          modoOperacao={
            typeof agente.modo_operacao === "string" ? agente.modo_operacao : null
          }
        />
      ) : null}

      <CrmConfirmDialog
        open={showArquivar}
        title="Arquivar agente"
        variant="destructive"
        confirmLabel="Confirmar arquivamento"
        loading={arquivando}
        loadingLabel="Arquivando…"
        confirmDisabled={motivoArquivamento.trim().length < 10}
        onCancel={() => !arquivando && setShowArquivar(false)}
        onConfirm={() => void confirmarArquivamento()}
      >
        <p style={{ margin: "0 0 10px" }}>
          Agente: <strong style={{ color: "#0b1f10" }}>{agente.nome}</strong>
        </p>
        <p style={{ margin: "0 0 14px", color: "#b3261e", fontWeight: 600 }}>
          Esta operação não pode ser desfeita.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#0b1f10", display: "block", marginBottom: 8 }}>
          Motivo do arquivamento <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <textarea
          value={motivoArquivamento}
          onChange={(e) => setMotivoArquivamento(e.target.value)}
          placeholder="Descreva o motivo (mínimo 10 caracteres)..."
          rows={3}
          style={{
            ...inputStyle,
            resize: "none",
            width: "100%",
            boxSizing: "border-box",
            border: `1px solid ${motivoArquivamento.length > 0 && motivoArquivamento.trim().length < 10 ? "#ef4444" : "#dcebd8"}`,
          }}
        />
        {motivoArquivamento.length > 0 && motivoArquivamento.trim().length < 10 ? (
          <p style={{ color: "#ef4444", fontSize: 11, margin: "8px 0 0" }}>
            Mínimo 10 caracteres ({motivoArquivamento.trim().length}/10)
          </p>
        ) : null}
      </CrmConfirmDialog>

      <CrmConfirmDialog
        open={showLimparMemorias}
        title="Limpar memórias do agente"
        variant="destructive"
        confirmLabel="Limpar memórias"
        loading={limpandoMemorias}
        loadingLabel="A limpar…"
        onCancel={() => !limpandoMemorias && setShowLimparMemorias(false)}
        onConfirm={() => void confirmarLimparMemorias()}
      >
        <p style={{ margin: "0 0 10px" }}>
          Remove aprendizados persistentes de <strong style={{ color: "#0b1f10" }}>{agente.nome}</strong> e zera o
          fluxo conversacional de todos os leads atribuídos a este agente.
        </p>
        {contagemMemorias ? (
          <p style={{ fontSize: 12, margin: "0 0 12px" }}>
            Encontrado: <strong>{contagemMemorias.memorias}</strong> memória(s) operacional(is)
            {incluirBriefingAoLimpar ? (
              <>
                {" "}
                e <strong>{contagemMemorias.briefingSessoes}</strong> sessão(ões) de briefing
              </>
            ) : null}
            ; <strong>{contagemMemorias.leads}</strong> lead(s) com estado conversacional (
            <strong>{contagemMemorias.memoriasLead}</strong> memória(s) de lead).
          </p>
        ) : (
          <p style={{ fontSize: 12, margin: "0 0 12px" }}>A contar registos…</p>
        )}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <input
            type="checkbox"
            checked={incluirBriefingAoLimpar}
            onChange={(e) => setIncluirBriefingAoLimpar(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            Também apagar histórico do chat <strong>AI — Funcionários</strong> (sessões de briefing deste agente).
          </span>
        </label>
        <p style={{ margin: "12px 0 0", color: "#b3261e", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
      </CrmConfirmDialog>

      <CrmConfirmDialog
        open={showConfirmSalvar}
        title="Confirmar alterações"
        confirmLabel="Confirmar"
        loading={salvando}
        loadingLabel="Salvando…"
        onCancel={() => !salvando && setShowConfirmSalvar(false)}
        onConfirm={() => void salvar()}
      >
        <p style={{ margin: 0 }}>
          Confirmar alterações no agente <strong style={{ color: "#0b1f10" }}>{nome}</strong>?
        </p>
      </CrmConfirmDialog>
    </div>
  );
}

function HeaderActionGroup({
  children,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  "aria-label"?: string;
}) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        flexWrap: "nowrap",
        maxWidth: "100%",
        overflowX: "auto",
        borderRadius: 10,
        border: "1px solid #d4ecd0",
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(11, 31, 16, 0.08)",
        flexShrink: 0,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {items.map((child, index) => {
        if (!isValidElement<{ position?: "first" | "middle" | "last" }>(child)) return child;
        const position: "first" | "middle" | "last" =
          index === 0 ? "first" : index === items.length - 1 ? "last" : "middle";
        return cloneElement(child, { position });
      })}
    </div>
  );
}

function HeaderActionButton({
  icon,
  label,
  onClick,
  variant,
  position,
  title,
}: {
  icon?: ReactNode | null;
  label: string;
  onClick: () => void;
  variant: "default" | "accent" | "secondary" | "danger";
  position: "first" | "middle" | "last";
  title?: string;
}) {
  const palette = (() => {
    switch (variant) {
      case "accent":
        return { bg: "#ecffd8", hoverBg: "#dcebd8", color: CRM_ACCENT, divider: "#d4ecd0" };
      case "secondary":
        return { bg: "#f8fcf6", hoverBg: "#eef7eb", color: "#3d5c48", divider: "#eef7eb" };
      case "danger":
        return { bg: "#fff5f5", hoverBg: "#fee2e2", color: "#dc2626", divider: "#fecaca" };
      default:
        return { bg: "#ffffff", hoverBg: "#eef7eb", color: BRAND_TEXT_DARK, divider: "#eef7eb" };
    }
  })();

  const radius =
    position === "first"
      ? { borderTopLeftRadius: 9, borderBottomLeftRadius: 9 }
      : position === "last"
        ? { borderTopRightRadius: 9, borderBottomRightRadius: 9 }
        : {};

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        background: palette.bg,
        border: "none",
        borderLeft: position === "first" ? "none" : `1px solid ${palette.divider}`,
        color: palette.color,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 140ms ease",
        flexShrink: 0,
        ...radius,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = palette.hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = palette.bg;
      }}
    >
      {icon}
      {label}
    </button>
  );
}

