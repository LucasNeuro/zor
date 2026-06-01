"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Clock, MessageSquare, Webhook, Zap } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  MODO_OPERACAO_DESCRICAO,
  MODO_OPERACAO_LABEL,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { AgenteFerramentasIaBlock, type CatalogoFerramentaCustomLite } from "@/components/crm/AgenteFerramentasIaBlock";
import {
  AgenteUazapiBlock,
  type AgenteUazapiSnapshot,
} from "@/components/crm/AgenteUazapiBlock";
import {
  mergeUsoFerramentasComPadraoPreservandoCustom,

} from "@/lib/hub/agente-ferramentas-registry";
import { isHubModeloIdDbCompatible } from "@/lib/ia/hub-model-defaults";
import {
  PlaybookUploadAnalisePanel,
  type PlaybookAnaliseResultado,
  type PlaybookUploadStatus,
} from "@/components/crm/PlaybookUploadAnalisePanel";
import { PlaybookFlowStatusBanner } from "@/components/crm/PlaybookFlowStatusBanner";
import {
  assessPlaybookFlowInMarkdown,
  playbookFlowReady,
} from "@/lib/playbook/playbook-flow-ui";
import { PLAYBOOK_EXEMPLO_MD_URL } from "@/lib/playbook/playbook-exemplo";
import {
  RAG_ACCEPT_ATTR,
  RAG_EXEMPLO_MD_URL,
  RAG_FORMATOS_RESUMO,
  ragErroPdfSemTexto,
  ragExtensaoAceita,
} from "@/lib/hub/rag-formatos";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];

/** Passos do assistente â€” apÃ³s Â«FerramentasÂ» e criar agente, passos 7â€“8 sÃ£o pÃ³s-criaÃ§Ã£o. */
const WIZARD_STEP_LABELS = [
  "Cargo",
  "Identidade",
  "Personalidade",
  "Documentos",
  "RevisÃ£o",
  "Ferramentas",
  "Materiais",
  "Canal",
] as const;

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  "OperaÃ§Ãµes": "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

const EIXOS = [
  {
    nome: "AnalÃ­tico / Criativo",
    frases: [
      "Baseie todas as respostas em dados e lÃ³gica. Evite linguagem subjetiva.",
      "Priorize dados, mas use analogias simples para clareza quando necessÃ¡rio.",
      "Equilibre argumentos racionais com exemplos prÃ¡ticos e linguagem acessÃ­vel.",
      "Use linguagem envolvente, exemplos criativos e storytelling leve.",
      "Seja criativo, use metÃ¡foras e linguagem que engaje emocionalmente.",
    ],
  },
  {
    nome: "Formal / Informal",
    frases: [
      "Mantenha linguagem completamente formal. Sem contraÃ§Ãµes nem gÃ­rias.",
      "Linguagem profissional e clara, pode usar contraÃ§Ãµes ocasionalmente.",
      "Tom neutro e acessÃ­vel, nem muito formal nem coloquial.",
      "Linguagem descontraÃ­da e prÃ³xima, como conversa entre colegas.",
      "Totalmente informal: uso de gÃ­rias leves e tom de conversa casual.",
    ],
  },
  {
    nome: "Direto / Detalhista",
    frases: [
      "Seja extremamente conciso. MÃ¡ximo 2 frases por resposta.",
      "Respostas curtas com a informaÃ§Ã£o essencial. Evite explicaÃ§Ãµes longas.",
      "Resposta completa mas sem excessos. Explique o necessÃ¡rio.",
      "Inclua contexto e justificativas relevantes nas respostas.",
      "Seja completo e detalhado. Antecipe dÃºvidas e inclua exemplos.",
    ],
  },
  {
    nome: "Conservador / Arrojado",
    frases: [
      "Seja cauteloso. Prefira caminhos testados e seguros. Aponte riscos.",
      "Sugira caminhos tradicionais como padrÃ£o, mas apresente alternativas.",
      "Equilibre sugestÃµes convencionais com oportunidades inovadoras.",
      "Proponha abordagens ousadas e diferenciadas. Destaque oportunidades.",
      "Seja provocador e disruptivo. Proponha ideias inovadoras.",
    ],
  },
  {
    nome: "EmpÃ¡tico / Objetivo",
    frases: [
      "Priorize o lado humano: valide sentimentos antes de resolver.",
      "ReconheÃ§a o contexto emocional antes de apresentar soluÃ§Ãµes.",
      "Equilibre empatia e objetividade. Valide brevemente e siga para a soluÃ§Ã£o.",
      "Foque na soluÃ§Ã£o e nos resultados prÃ¡ticos. Seja cordial mas eficiente.",
      "Totalmente focado em resultado e eficiÃªncia. Sem rodeios emocionais.",
    ],
  },
];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function gerarPersonalidade(valores: number[]): string {
  return (
    "## Tom e estilo de comunicaÃ§Ã£o\n\n" +
    EIXOS.map((e, i) => e.frases[valores[i] - 1]).join("\n")
  );
}

/** Modelos definidos no catÃ¡logo do cargo â€” alguns IDs antigos sÃ£o normalizados para `mistral` no servidor. */
function cargoModelosForaDaListaHub(c: Cargo): string[] {
  const out: string[] = [];
  for (const key of ["modelo_padrao", "modelo_critico", "modelo_alto_valor"] as const) {
    const v = c[key];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t && !isHubModeloIdDbCompatible(t)) out.push(`${key}: ${t}`);
  }
  return out;
}

function splitLinesLite(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
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
  modelo_critico?: string;
  modelo_alto_valor?: string;
  saudacao_cliente?: string;
  usar_perguntas_essenciais?: boolean;
  perguntas_essenciais?: string[] | string;
  comprimento_padrao?: string;
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
  if (tipo === "continuo") return "contÃ­nuo";
  if (tipo === "programado") return "programado";
  if (tipo === "gatilho") return "gatilho";
  return tipo;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extractApiError(payload: Record<string, unknown>, fallback: string): string {
  const base = typeof payload.error === "string" && payload.error.trim() ? payload.error.trim() : fallback;
  const errs = Array.isArray(payload.errors)
    ? payload.errors.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (!errs.length) return base;
  return `${base}\n- ${errs.join("\n- ")}`;
}

const RAG_DOCS_LIMIT = 3;
const PLAYBOOK_MAX_BYTES = 2 * 1024 * 1024;
const PLAYBOOK_INPUT_PRE = "playbook-upload-input-pre";
const PLAYBOOK_INPUT_POS = "playbook-upload-input-pos";

function ragDocExt(nome: string): string {
  const ext = nome.split(".").pop()?.trim().toUpperCase();
  return ext && ext.length <= 5 ? ext : "DOC";
}

function ragFileKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

function RagErroAjuda({ mensagem }: { mensagem: string }) {
  if (!mensagem.trim()) return null;
  const pdf = ragErroPdfSemTexto(mensagem);
  const formato = /formato nÃ£o suportado|nÃ£o indexÃ¡vel/i.test(mensagem);
  if (!pdf && !formato) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(88,166,255,0.35)",
        background: "rgba(88,166,255,0.08)",
        color: "#adbac7",
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      {pdf ? (
        <p style={{ margin: "0 0 8px" }}>
          <strong style={{ color: "#58a6ff" }}>PDF sem texto seleccionÃ¡vel.</strong> Muitos PDFs criados com
          &quot;Imprimir&quot; ou digitalizados nÃ£o indexam. Use{" "}
          <a
            href={RAG_EXEMPLO_MD_URL}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#58a6ff", fontWeight: 700 }}
          >
            o ficheiro .md de exemplo
          </a>{" "}
          ou exporte o mesmo conteÃºdo em <strong style={{ color: "#e6edf3" }}>.docx</strong> /{" "}
          <strong style={{ color: "#e6edf3" }}>.md</strong>.
        </p>
      ) : null}
      {formato ? (
        <p style={{ margin: pdf ? 0 : "0 0 8px" }}>
          Formatos aceites: <strong style={{ color: "#e6edf3" }}>{RAG_FORMATOS_RESUMO}</strong>.
        </p>
      ) : null}
    </div>
  );
}

type RagFilaStatus = "na_fila" | "preparado" | "processando" | "concluido" | "erro";

type RagFilaItem = {
  file: File;
  status: RagFilaStatus;
  mensagem?: string;
};

function toLinhasLista(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\n|â€¢|- /)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pickTexto(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizarAnalisePlaybook(raw: Record<string, unknown>): PlaybookAnaliseResultado {
  const nested =
    raw.analise && typeof raw.analise === "object" && !Array.isArray(raw.analise)
      ? (raw.analise as Record<string, unknown>)
      : raw;
  const resumo =
    pickTexto(nested, ["resumo_executivo", "resumo", "summary", "analise_resumo", "analysis"]) ||
    pickTexto(raw, ["resumo", "summary"]) ||
    "AnÃ¡lise concluÃ­da sem resumo estruturado.";
  const notaRaw = nested.nota ?? raw.nota;
  const nota =
    typeof notaRaw === "number" && Number.isFinite(notaRaw)
      ? Math.min(10, Math.max(0, Math.round(notaRaw * 10) / 10))
      : typeof notaRaw === "string"
        ? (() => {
            const n = Number.parseFloat(notaRaw.replace(",", "."));
            return Number.isFinite(n) ? Math.min(10, Math.max(0, Math.round(n * 10) / 10)) : null;
          })()
        : null;
  const notaComentario = pickTexto(nested, ["nota_comentario", "notaComentario"]);
  const pontosChave = toLinhasLista(
    nested.pontos_fortes ?? nested.pontos_chave ?? nested.highlights ?? nested.insights
  );
  const gaps = toLinhasLista(nested.gaps ?? nested.lacunas);
  const riscos = toLinhasLista(nested.riscos ?? nested.risks);
  const recomendacoes = toLinhasLista(
    nested.sugestoes ?? nested.recomendacoes ?? nested.recommendations ?? nested.proximos_passos
  );
  const textoBruto =
    pickTexto(raw, ["texto", "raw_text", "resultado", "output", "content"]) ||
    JSON.stringify(raw, null, 2);
  const modelo = pickTexto(raw, ["model", "modelo"]) || null;

  return {
    resumo,
    nota,
    notaComentario,
    pontosChave,
    gaps,
    riscos,
    recomendacoes,
    textoBruto,
    modelo,
    origem: "mistral",
  };
}

export type AgenteNovoWizardProps = {
  variant: "page" | "drawer";
  onClose?: () => void;
  onCreated?: (agente: { agente_slug: string }) => void;
};

export function AgenteNovoWizard({ variant, onClose, onCreated }: AgenteNovoWizardProps) {
  const router = useRouter();

  const [passo, setPasso] = useState(1);
  const [dialogFecharAssistente, setDialogFecharAssistente] = useState(false);
  const [cargoSelecionado, setCargoSelecionado] = useState<Cargo | null>(null);
  /** Sem cargo no catÃ¡logo â€” instruÃ§Ãµes sÃ³ do playbook publicado no bucket. */
  const [somentePlaybook, setSomentePlaybook] = useState(false);
  const [nome, setNome] = useState("");
  const [mercados, setMercados] = useState<string[]>([]);
  const [valores, setValores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [criando, setCriando] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erro, setErro] = useState("");

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [filtroSegmento, setFiltroSegmento] = useState<string>("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>("");


  /** PadrÃ£o recomendado: copiloto interno. */
  const [modoOperacao, setModoOperacao] = useState<ModoOperacaoAgente>("jobs_internos");
  /** Onde/quando opera: gravado como hub_ciclos_ia. */
  const [modoExecucao, setModoExecucao] = useState<"interacao" | "tempo_real" | "agenda">("agenda");
  const [agendaIntervalMin, setAgendaIntervalMin] = useState<15 | 60 | 360 | 1440>(60);

  /** `provisionar`: cria linha padrÃ£o + opcional vincular mais; `somente_vincular`: sÃ³ atualiza slugs em hub_ciclos_ia. */
  const [hubCicloEstrategia, setHubCicloEstrategia] = useState<"provisionar" | "somente_vincular">(
    "provisionar"
  );
  const [hubCiclosLista, setHubCiclosLista] = useState<HubCicloPickListItem[]>([]);
  const [hubCiclosCarregando, setHubCiclosCarregando] = useState(false);
  const [hubCiclosVincularIds, setHubCiclosVincularIds] = useState<string[]>([]);
  const hubCiclosLoadRef = useRef(false);

  const [motorFerramentasHub, setMotorFerramentasHub] = useState(false);
  const [mistralProvisionar, setMistralProvisionar] = useState(false);
  const [usoFerramentasIa, setUsoFerramentasIa] = useState<Record<string, boolean>>(() =>
    mergeUsoFerramentasComPadraoPreservandoCustom({})
  );
  const [catalogoCustomFerramentasWizard, setCatalogoCustomFerramentasWizard] = useState<
    CatalogoFerramentaCustomLite[]
  >([]);

  const [erroCargos, setErroCargos] = useState(false);

  /** Preenchido apÃ³s POST bem-sucedido em `/api/hub/agentes`. */
  const [agenteSlugCriado, setAgenteSlugCriado] = useState<string | null>(null);
  const [uazapiSnap, setUazapiSnap] = useState<AgenteUazapiSnapshot | null>(null);
  const [playbookMetaLoading, setPlaybookMetaLoading] = useState(false);
  const [playbookGerando, setPlaybookGerando] = useState(false);
  const [playbookErro, setPlaybookErro] = useState("");
  const [playbookPublicUrl, setPlaybookPublicUrl] = useState<string | null>(null);
  const [playbookArquivoNome, setPlaybookArquivoNome] = useState("");
  const [playbookUploadStatus, setPlaybookUploadStatus] = useState<PlaybookUploadStatus>("idle");
  const [playbookUploadMensagem, setPlaybookUploadMensagem] = useState("");
  const [playbookUploadPct, setPlaybookUploadPct] = useState(0);
  const [playbookConteudoPreview, setPlaybookConteudoPreview] = useState("");
  const [playbookConteudoAnalise, setPlaybookConteudoAnalise] = useState("");
  const [playbookAnaliseLoading, setPlaybookAnaliseLoading] = useState(false);
  const [playbookAnalisePct, setPlaybookAnalisePct] = useState(0);
  const [playbookAnaliseErro, setPlaybookAnaliseErro] = useState("");
  const [playbookAnaliseResultado, setPlaybookAnaliseResultado] = useState<PlaybookAnaliseResultado | null>(null);
  const [playbookArquivoPendente, setPlaybookArquivoPendente] = useState<File | null>(null);
  const playbookFlowStatus = assessPlaybookFlowInMarkdown(playbookConteudoAnalise);
  /** Escolhidos no passo Documentos; enviados e indexados logo apÃ³s Â«Criar agenteÂ». */
  const [ragPendentes, setRagPendentes] = useState<RagFilaItem[]>([]);
  const [ragPendenteErro, setRagPendenteErro] = useState("");
  const [ragPosCriacaoAviso, setRagPosCriacaoAviso] = useState("");
  const [ragPreparando, setRagPreparando] = useState(false);
  const [ragPreparados, setRagPreparados] = useState(false);
  const [ragUploadTotal, setRagUploadTotal] = useState(0);
  const [ragUploadDone, setRagUploadDone] = useState(0);
  /** Passo Canal: PATCH do modo WhatsApp antes de acÃ§Ãµes UAZAPI. */
  const [syncCanalLoading, setSyncCanalLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/hub/ferramentas-custom?all=true", { headers: internalApiHeaders() });
        const d: unknown = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(d)) return;
        setCatalogoCustomFerramentasWizard(
          (d as Record<string, unknown>[])
            .map((x) => ({
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
            .filter((c) => c.ferramenta_key.length > 0 && c.ativo)
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const refreshSnapshotUazapi = useCallback(async () => {
    if (!agenteSlugCriado) return;
    try {
      const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}`, {
        headers: internalApiHeaders(),
      });
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) return;
      setUazapiSnap({
        uazapi_instance_id:
          typeof d.uazapi_instance_id === "string" ? d.uazapi_instance_id : null,
        uazapi_instance_name:
          typeof d.uazapi_instance_name === "string" ? d.uazapi_instance_name : null,
        uazapi_connection_status:
          typeof d.uazapi_connection_status === "string" ? d.uazapi_connection_status : null,
        uazapi_has_instance_token: d.uazapi_has_instance_token === true,
        uazapi_proxy_country:
          typeof d.uazapi_proxy_country === "string" ? d.uazapi_proxy_country : null,
        uazapi_proxy_state: typeof d.uazapi_proxy_state === "string" ? d.uazapi_proxy_state : null,
        uazapi_proxy_city: typeof d.uazapi_proxy_city === "string" ? d.uazapi_proxy_city : null,
      });
    } catch {
      /* ignore */
    }
  }, [agenteSlugCriado]);

  useEffect(() => {
    if (passo !== 8 || !agenteSlugCriado) {
      setSyncCanalLoading(false);
      return;
    }
    let cancel = false;
    setSyncCanalLoading(true);
    void (async () => {
      const ok = await sincronizarWizardNoAgente(agenteSlugCriado);
      if (cancel) return;
      setSyncCanalLoading(false);
      if (!ok) return;
      if (modoOperacao === "canal_whatsapp") await refreshSnapshotUazapi();
    })();
    return () => {
      cancel = true;
    };
  }, [passo, agenteSlugCriado, modoOperacao, modoExecucao]);

  useEffect(() => {
    if (passo !== 7 || !agenteSlugCriado) return;
    let cancel = false;
    setPlaybookMetaLoading(true);
    setPlaybookErro("");
    (async () => {
      try {
        const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook`, {
          headers: internalApiHeaders(),
        });
        const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancel) return;
        if (!r.ok) {
          setPlaybookErro(typeof d.error === "string" ? d.error : "Sem metadados de playbook.");
          setPlaybookPublicUrl(null);
          return;
        }
        setPlaybookErro("");
        setPlaybookPublicUrl(
          typeof d.playbook_public_url === "string" && d.playbook_public_url.trim()
            ? d.playbook_public_url.trim()
            : null
        );
      } catch {
        if (!cancel) setPlaybookErro("Falha ao ler playbook.");
      } finally {
        if (!cancel) setPlaybookMetaLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [passo, agenteSlugCriado]);

  function adicionarRagPendente(file: File | null | undefined) {
    if (!file) return;
    if (!ragExtensaoAceita(file.name)) {
      setRagPendenteErro(`Formato nÃ£o suportado. Formatos aceites: ${RAG_FORMATOS_RESUMO}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRagPendenteErro("Arquivo maior que 5 MB.");
      return;
    }
    if (ragPendentes.length >= RAG_DOCS_LIMIT) {
      setRagPendenteErro(`Limite de ${RAG_DOCS_LIMIT} documentos. Remova um antes de adicionar outro.`);
      return;
    }
    const key = ragFileKey(file);
    if (ragPendentes.some((item) => ragFileKey(item.file) === key)) {
      setRagPendenteErro("Este arquivo jÃ¡ estÃ¡ na lista.");
      return;
    }
    setRagPendenteErro("");
    setRagPreparados(false);
    setRagUploadTotal(0);
    setRagUploadDone(0);
    setRagPendentes((prev) => [...prev, { file, status: "na_fila" }]);
  }

  function removerRagPendentePorIndice(i: number) {
    setRagPendentes((prev) => prev.filter((_, idx) => idx !== i));
    setRagPendenteErro("");
    setRagPreparados(false);
    setRagUploadTotal(0);
    setRagUploadDone(0);
  }

  async function processarFilaRagNoAgente(slug: string): Promise<string[]> {
    const pendentesSnapshot = [...ragPendentes];
    if (pendentesSnapshot.length === 0) return [];

    setRagPendentes(pendentesSnapshot.map((item) => ({ ...item, status: "preparado" })));
    const falhas: string[] = [];
    setRagUploadTotal(pendentesSnapshot.length);
    setRagUploadDone(0);

    for (let i = 0; i < pendentesSnapshot.length; i++) {
      const file = pendentesSnapshot[i].file;
      setRagPendentes((prev) =>
        prev.map((item) =>
          ragFileKey(item.file) === ragFileKey(file)
            ? { ...item, status: "processando", mensagem: "A enviar e indexar..." }
            : item
        )
      );

      const form = new FormData();
      form.append("file", file);
      try {
        const r = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/rag-documentos`, {
          method: "POST",
          headers: internalApiHeaders(),
          body: form,
        });
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          falhas.push(`${file.name}: ${d.error || `HTTP ${r.status}`}`);
          setRagPendentes((prev) =>
            prev.map((item) =>
              ragFileKey(item.file) === ragFileKey(file)
                ? { ...item, status: "erro", mensagem: d.error || `HTTP ${r.status}` }
                : item
            )
          );
        } else {
          setRagPendentes((prev) =>
            prev.map((item) =>
              ragFileKey(item.file) === ragFileKey(file)
                ? { ...item, status: "concluido", mensagem: "Processado com sucesso." }
                : item
            )
          );
        }
      } catch {
        falhas.push(`${file.name}: falha de rede`);
        setRagPendentes((prev) =>
          prev.map((item) =>
            ragFileKey(item.file) === ragFileKey(file)
              ? { ...item, status: "erro", mensagem: "Falha de rede." }
              : item
          )
        );
      }
      setRagUploadDone(i + 1);
    }

    if (falhas.length === 0) {
      setRagPosCriacaoAviso("Documentos RAG processados com sucesso.");
    } else {
      setRagPosCriacaoAviso(
        falhas.length === pendentesSnapshot.length
          ? `Documentos RAG: nenhum foi processado com sucesso. ${falhas.join(" Â· ")}`
          : `Documentos RAG: processamento parcial. ${falhas.join(" Â· ")}`
      );
    }
    return falhas;
  }

  async function prepararEmbeddingsFila() {
    if (ragPendentes.length === 0) {
      setRagPendenteErro("Adicione pelo menos 1 documento na fila.");
      return;
    }
    setRagPreparando(true);
    setRagPendenteErro("");
    setRagPosCriacaoAviso("");
    try {
      if (!agenteSlugCriado) {
        if ((!somentePlaybook && !cargoSelecionado) || !nome.trim()) {
          setRagPendenteErro("Preencha cargo (ou modo sÃ³ playbook) e nome antes de processar embeddings.");
          return;
        }
        setRagPreparados(true);
        // Cria o agente e indexa, mas mantÃ©m o utilizador no passo actual (RevisÃ£o/Ferramentas vÃªm a seguir).
        await criarAgente({ avancarPasso: false });
        return;
      }
      setRagPendentes((prev) =>
        prev.map((item) => ({ ...item, status: "preparado", mensagem: "Pronto para upload." }))
      );
      setRagPreparados(true);
      await processarFilaRagNoAgente(agenteSlugCriado);
    } finally {
      setRagPreparando(false);
    }
  }

  async function gerarPlaybookNoStorage() {
    if (!agenteSlugCriado) return;
    setPlaybookGerando(true);
    setPlaybookErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPlaybookErro(typeof data.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      setPlaybookMetaLoading(true);
      try {
        const r2 = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook`, {
          headers: internalApiHeaders(),
        });
        const d2 = (await r2.json().catch(() => ({}))) as Record<string, unknown>;
        if (r2.ok) {
          setPlaybookErro("");
          setPlaybookPublicUrl(
            typeof d2.playbook_public_url === "string" && d2.playbook_public_url.trim()
              ? d2.playbook_public_url.trim()
              : null
          );
        }
      } finally {
        setPlaybookMetaLoading(false);
      }
    } catch {
      setPlaybookErro("Falha ao gerar playbook.");
    } finally {
      setPlaybookGerando(false);
      setPlaybookMetaLoading(false);
    }
  }

  function validarPlaybookArquivo(file: File): string | null {
    const nomeLower = file.name.toLowerCase();
    const tipoAceito = file.type === "text/markdown" || file.type === "text/plain";
    const extAceita = nomeLower.endsWith(".md") || nomeLower.endsWith(".txt");
    if (!tipoAceito && !extAceita) {
      return "Formato invÃ¡lido. Envie um arquivo .md ou .txt.";
    }
    if (file.size <= 0) return "Arquivo vazio. Escolha um arquivo com conteÃºdo.";
    if (file.size > PLAYBOOK_MAX_BYTES) return "Arquivo acima de 2 MB. Reduza o tamanho e tente novamente.";
    return null;
  }

  function lerArquivoTexto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsText(file, "utf-8");
    });
  }

  async function carregarPlaybookLocal(file: File) {
    const erroValidacao = validarPlaybookArquivo(file);
    if (erroValidacao) {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem(erroValidacao);
      return;
    }

    setPlaybookArquivoNome(file.name);
    setPlaybookArquivoPendente(file);
    setPlaybookUploadStatus("enviando");
    setPlaybookUploadMensagem("A ler arquivo...");
    setPlaybookUploadPct(40);
    setPlaybookAnaliseErro("");
    setPlaybookAnaliseResultado(null);

    try {
      const texto = (await lerArquivoTexto(file)).trim();
      if (!texto) {
        setPlaybookUploadStatus("erro");
        setPlaybookUploadMensagem("NÃ£o foi possÃ­vel extrair texto do arquivo.");
        setPlaybookUploadPct(0);
        setPlaybookArquivoPendente(null);
        return;
      }
      setPlaybookConteudoPreview(texto.slice(0, 2500));
      setPlaybookConteudoAnalise(texto);
      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem("Arquivo carregado. Analise o playbook antes de continuar.");
    } catch {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem("Falha ao ler o arquivo.");
      setPlaybookUploadPct(0);
      setPlaybookArquivoPendente(null);
    }
  }

  async function salvarPlaybookPorUpload(file: File, slugOverride?: string) {
    const slugAlvo = slugOverride || agenteSlugCriado;
    if (!slugAlvo) {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem("Crie o agente antes de enviar o playbook.");
      return;
    }

    const erroValidacao = validarPlaybookArquivo(file);
    if (erroValidacao) {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem(erroValidacao);
      return;
    }

    setPlaybookArquivoNome(file.name);
    setPlaybookUploadStatus("enviando");
    setPlaybookUploadMensagem("A enviar playbook...");
    setPlaybookUploadPct(15);
    setPlaybookErro("");
    setPlaybookAnaliseErro("");
    setPlaybookAnaliseResultado(null);

    try {
      const texto = (await lerArquivoTexto(file)).trim();
      if (!texto) {
        setPlaybookUploadStatus("erro");
        setPlaybookUploadMensagem("NÃ£o foi possÃ­vel extrair texto do arquivo.");
        setPlaybookUploadPct(0);
        return;
      }
      setPlaybookConteudoPreview(texto.slice(0, 2500));
      setPlaybookConteudoAnalise(texto);
      setPlaybookUploadPct(45);

      // Endpoint principal esperado para upload manual do playbook.
      const form = new FormData();
      form.append("file", file);
      form.append("content", texto);
      form.append("source", "wizard_upload");
      let uploadRes = await fetch(`/api/hub/agentes/${encodeURIComponent(slugAlvo)}/playbook/upload`, {
        method: "POST",
        headers: internalApiHeaders(),
        body: form,
      });

      // Fallback defensivo: se o endpoint novo nÃ£o existir, tenta contrato JSON no endpoint atual.
      if (uploadRes.status === 404 || uploadRes.status === 405) {
        uploadRes = await fetch(`/api/hub/agentes/${encodeURIComponent(slugAlvo)}/playbook`, {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            force: true,
            uploaded_markdown: texto,
            uploaded_filename: file.name,
            source: "wizard_upload",
          }),
        });
      }

      const payload = (await uploadRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!uploadRes.ok) {
        const msg = extractApiError(payload, `Falha no upload (HTTP ${uploadRes.status}).`);
        setPlaybookUploadStatus("erro");
        setPlaybookUploadMensagem(msg);
        setPlaybookUploadPct(0);
        return;
      }

      const retornoUrl =
        typeof payload.playbook_public_url === "string" && payload.playbook_public_url.trim()
          ? payload.playbook_public_url.trim()
          : null;
      if (retornoUrl) setPlaybookPublicUrl(retornoUrl);
      else await gerarPlaybookNoStorage();

      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem("Playbook enviado com sucesso.");
    } catch {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadPct(0);
      setPlaybookUploadMensagem("Falha de rede ao enviar playbook.");
    }
  }

  async function analisarPlaybookComMistral() {
    if (!playbookConteudoAnalise.trim()) {
      setPlaybookAnaliseErro("Carregue um playbook antes de solicitar anÃ¡lise.");
      return;
    }

    setPlaybookAnaliseLoading(true);
    setPlaybookAnaliseErro("");
    setPlaybookAnaliseResultado(null);
    setPlaybookAnalisePct(6);

    const tick = window.setInterval(() => {
      setPlaybookAnalisePct((p) => {
        if (p >= 92) return p;
        const step = Math.max(1, Math.round((92 - p) * (0.06 + Math.random() * 0.06)));
        return Math.min(92, p + step);
      });
    }, 180);

    let analiseOk = false;
    try {
      const body = {
        content: playbookConteudoAnalise,
        filename: playbookArquivoNome || "playbook.md",
        source: "wizard_upload",
      };

      let res: Response;
      if (agenteSlugCriado) {
        res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook/analisar`, {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/hub/playbook/analisar-conteudo`, {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        setPlaybookAnaliseResultado(normalizarAnalisePlaybook(data));
        analiseOk = true;
        return;
      }

      if (res.status === 503 && !agenteSlugCriado) {
        setPlaybookAnaliseErro("Configure MISTRAL_API_KEY no servidor para anÃ¡lise com nota.");
        return;
      }

      // Fallback final apenas com agente jÃ¡ criado.
      if (agenteSlugCriado && (res.status === 404 || res.status === 405 || res.status >= 500)) {
        const syncRes = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/mistral-sync`, {
          method: "POST",
          headers: internalApiHeaders(),
        });
        const syncData = (await syncRes.json().catch(() => ({}))) as { error?: string; mistral_agent_id?: string };
        const detalhes = syncRes.ok
          ? `Sync Mistral OK${syncData.mistral_agent_id ? ` (agent: ${syncData.mistral_agent_id})` : ""}.`
          : syncData.error || `HTTP ${syncRes.status}`;
        const linhas = playbookConteudoAnalise
          .split("\n")
          .map((linha) => linha.trim())
          .filter(Boolean)
          .slice(0, 8);
        setPlaybookAnaliseResultado({
          resumo:
            "AnÃ¡lise textual local concluÃ­da. Endpoint de anÃ¡lise Mistral ainda indisponÃ­vel neste ambiente.",
          nota: null,
          notaComentario: "",
          pontosChave: linhas,
          gaps: [],
          riscos: ["Valide no backend o endpoint POST /playbook/analisar."],
          recomendacoes: ["Clique novamente apÃ³s configurar MISTRAL_API_KEY."],
          textoBruto: detalhes,
          modelo: null,
          origem: "fallback",
        });
        analiseOk = true;
        return;
      }

      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setPlaybookAnaliseErro(err.error || `Falha na anÃ¡lise (HTTP ${res.status}).`);
    } catch {
      setPlaybookAnaliseErro("Falha de rede ao analisar o playbook.");
    } finally {
      window.clearInterval(tick);
      if (analiseOk) {
        setPlaybookAnalisePct(100);
        await new Promise((r) => setTimeout(r, 420));
      }
      setPlaybookAnaliseLoading(false);
      setPlaybookAnalisePct(0);
    }
  }

  async function aplicarTemplatePadraoV1NoWizard() {
    if (playbookUploadStatus === "enviando" || playbookAnaliseLoading) return;
    setPlaybookErro("");
    try {
      const res = await fetch(PLAYBOOK_EXEMPLO_MD_URL, { headers: internalApiHeaders() });
      if (!res.ok) {
        setPlaybookErro(`Falha ao carregar template padrÃ£o (HTTP ${res.status}).`);
        return;
      }
      const texto = (await res.text()).trim();
      if (!texto) {
        setPlaybookErro("Template padrÃ£o vazio.");
        return;
      }
      setPlaybookArquivoNome("playbook-template-v1.md");
      setPlaybookConteudoPreview(texto.slice(0, 2500));
      setPlaybookConteudoAnalise(texto);
      setPlaybookArquivoPendente(null);
      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem("Template padrao v1 aplicado. Ajuste o conteudo e analise o playbook.");
      setPlaybookAnaliseErro("");
      setPlaybookAnaliseResultado(null);
    } catch {
      setPlaybookErro("Falha de rede ao carregar template padrÃ£o.");
    }
  }

  function concluirPosCriacao() {
    if (variant === "drawer" && onClose) onClose();
    else router.push("/crm/agentes");
  }

  const playbookDropzoneBorder =
    playbookUploadStatus === "hover"
      ? "1px dashed #58a6ff"
      : playbookUploadStatus === "erro"
        ? "1px dashed #f85149"
        : playbookUploadStatus === "sucesso"
          ? "1px dashed #3fb950"
          : "1px dashed #3d444d";

  const playbookDropzoneBg =
    playbookUploadStatus === "hover"
      ? "#58a6ff14"
      : playbookUploadStatus === "erro"
        ? "#f8514912"
        : playbookUploadStatus === "sucesso"
          ? "#23863618"
          : "#0d1117";

  const passo1AvancarBloqueado = somentePlaybook
    ? !playbookConteudoAnalise.trim() || !playbookAnaliseResultado || !playbookFlowReady(playbookFlowStatus)
    : !cargoSelecionado;

  useEffect(() => {
    if (passo !== 6) {
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

  function fecharAssistente() {
    if (variant === "drawer" && onClose) onClose();
    else router.back();
  }

  function handleBackClick() {
    if (agenteSlugCriado && passo >= 7) {
      setDialogFecharAssistente(true);
      return;
    }
    fecharAssistente();
  }

  /** Grava no servidor o que o utilizador escolheu no wizard (modo, ciclos, ferramentas). */
  async function sincronizarWizardNoAgente(slug: string): Promise<boolean> {
    const cicloExecucaoPadrao =
      modoOperacao === "canal_whatsapp" ? "interacao" : modoExecucao;
    const syncRes = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        prefixo_mercado: mercados.join(","),
        personalidade: gerarPersonalidade(valores),
        modo_operacao: modoOperacao,
        ciclo_execucao_padrao: cicloExecucaoPadrao,
        motor_ferramentas_habilitado: motorFerramentasHub,
        mistral_agent_sync_habilitado: mistralProvisionar,
        uso_ferramentas_ia: usoFerramentasIa,
      }),
    });
    if (!syncRes.ok) {
      const pe = (await syncRes.json().catch(() => ({}))) as { error?: string };
      setErro(
        pe.error ||
          "NÃ£o foi possÃ­vel gravar a configuraÃ§Ã£o do agente. Tente de novo ou abra a ficha do agente."
      );
      return false;
    }
    return true;
  }

  async function criarAgente(opts?: { avancarPasso?: boolean }) {
    const avancarPasso = opts?.avancarPasso ?? true;
    if (!somentePlaybook && !cargoSelecionado) return;
    setCriando(true);
    setErro("");
    setRagPosCriacaoAviso("");
    try {
      if (hubCicloEstrategia === "somente_vincular" && hubCiclosVincularIds.length === 0) {
        setErro("Selecione pelo menos um ciclo da Central para associar a este agente.");
        setCriando(false);
        return;
      }

      const payload: Record<string, unknown> = {
        nome,
        prefixo_mercado: mercados.join(","),
        personalidade: gerarPersonalidade(valores),
        system_prompt_base: "",
        conhecimento_secoes: {},
        bio: null,
        horario_inicio: "08:00",
        horario_fim: "22:00",
        motor_ferramentas_habilitado: motorFerramentasHub,
        mistral_agent_sync_habilitado: mistralProvisionar,
        uso_ferramentas_ia: usoFerramentasIa,
      };
      if (somentePlaybook) {
        payload.playbook_only = true;
      } else if (cargoSelecionado) {
        payload.cargo_slug = cargoSelecionado.slug;
      }

      if (hubCicloEstrategia === "somente_vincular") {
        payload.omit_hub_ciclo_padrao = true;
        payload.ciclos_vincular_ids = hubCiclosVincularIds;
        payload.modo_operacao = modoOperacao;
        payload.ciclo_execucao =
          modoOperacao === "canal_whatsapp" ? "interacao" : modoExecucao;
        if (modoExecucao === "agenda" && modoOperacao !== "canal_whatsapp") {
          payload.ciclo_intervalo_minutos = agendaIntervalMin;
        }
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
          motor_ferramentas_habilitado?: boolean;
          mistral_agent_sync_habilitado?: boolean;
          uso_ferramentas_ia?: unknown;
        };
        const slug = data.agente_slug;
        if (data.ciclo_erro) {
          console.error("[CRM] Agent criado mas ciclo padrÃ£o falhou:", data.ciclo_erro);
        } else if (data.ciclo_aviso) {
          console.warn("[CRM]", data.ciclo_aviso);
        }

        if (slug) {
          if (somentePlaybook && playbookArquivoPendente) {
            await salvarPlaybookPorUpload(playbookArquivoPendente, slug);
          }
          await processarFilaRagNoAgente(slug);
          const noServidor = mergeUsoFerramentasComPadraoPreservandoCustom(data.uso_ferramentas_ia);
          const noWizard = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa);
          const chaves = new Set([...Object.keys(noServidor), ...Object.keys(noWizard)]);
          let usoDiferente = false;
          for (const k of chaves) {
            if ((noServidor[k] === true) !== (noWizard[k] === true)) {
              usoDiferente = true;
              break;
            }
          }
          const motorDiferente = motorFerramentasHub !== (data.motor_ferramentas_habilitado === true);
          const mistralDiferente = mistralProvisionar !== (data.mistral_agent_sync_habilitado === true);
          if (usoDiferente || motorDiferente || mistralDiferente) {
            await sincronizarWizardNoAgente(slug);
          }
        }

        if (slug && onCreated) onCreated({ agente_slug: slug });
        setAgenteSlugCriado(slug ?? null);
        setShowConfirm(false);
        if (slug) {
          if (avancarPasso) setPasso(7);
        } else setErro("Agente criado mas a API nÃ£o devolveu o slug.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { erro?: string; error?: string };
        setErro(data.erro || data.error || "Erro ao criar agente.");
        setShowConfirm(false);
      }
    } catch {
      setErro("Falha na requisiÃ§Ã£o.");
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
              Confirmar criaÃ§Ã£o
            </h2>
            <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Confirmar criaÃ§Ã£o do agente <strong style={{ color: "#e6edf3" }}>{nome}</strong>? Em seguida passarÃ¡ por
              Materiais (playbook) e, se aplicÃ¡vel, Canal (WhatsApp UAZAPI).
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
                onClick={() => void criarAgente({ avancarPasso: true })}
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
              â†
            </button>
          </div>
          {cargoSelecionado && nome && (
            <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
              {nome} Â· {cargoSelecionado.titulo}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            overflowX: "auto",
            paddingBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {WIZARD_STEP_LABELS.map((label, i) => {
            const num = i + 1;
            const ativo = passo === num;
            const passado = passo > num;
            return (
              <div key={num} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 56 }}>
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
                    {passado ? "âœ“" : num}
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      color: ativo ? "#c9a24a" : "#8b949e",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      maxWidth: 72,
                      lineHeight: 1.15,
                    }}
                  >
                    {label}
                  </span>
                </div>
                {i < WIZARD_STEP_LABELS.length - 1 && (
                  <div
                    style={{
                      height: 2,
                      flex: 0,
                      width: 12,
                      flexShrink: 0,
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
        <div
          style={{
            maxWidth: passo === 6 || passo === 8 ? 1180 : 760,
            margin: "0 auto",
            padding: "28px 24px 48px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {passo === 1 && (
            <div>
              <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                Como este agente serÃ¡ instruÃ­do?
              </h2>
              <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 16px" }}>
                Escolha um cargo do catÃ¡logo ou carregue um playbook personalizado (.md / .txt) para instruir o agente.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setSomentePlaybook(false);
                  }}
                  style={chip(!somentePlaybook)}
                >
                  Cargo do catÃ¡logo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSomentePlaybook(true);
                    setCargoSelecionado(null);
                  }}
                  style={chip(somentePlaybook, "#c9a24a")}
                >
                  SÃ³ playbook (sem cargo)
                </button>
              </div>

              {somentePlaybook ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => void aplicarTemplatePadraoV1NoWizard()}
                      disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #30363d",
                        background: "#21262d",
                        color: "#c9d1d9",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor:
                          playbookUploadStatus === "enviando" || playbookAnaliseLoading
                            ? "not-allowed"
                            : "pointer",
                        opacity: playbookUploadStatus === "enviando" || playbookAnaliseLoading ? 0.65 : 1,
                      }}
                    >
                      Aplicar template padrao v1
                    </button>
                  </div>
                  <PlaybookUploadAnalisePanel
                    inputId={PLAYBOOK_INPUT_PRE}
                    modoPreCriacao
                    uploadStatus={playbookUploadStatus}
                    uploadMensagem={playbookUploadMensagem}
                    uploadPct={playbookUploadPct}
                    arquivoNome={playbookArquivoNome}
                    conteudoPreview={playbookConteudoPreview}
                    conteudoCarregado={!!playbookConteudoAnalise.trim()}
                    analiseLoading={playbookAnaliseLoading}
                    analisePct={playbookAnalisePct}
                    analiseErro={playbookAnaliseErro}
                    analiseResultado={playbookAnaliseResultado}
                    dropzoneBorder={playbookDropzoneBorder}
                    dropzoneBg={playbookDropzoneBg}
                    onHoverChange={(hover) => {
                      if (playbookUploadStatus !== "enviando") {
                        setPlaybookUploadStatus(hover ? "hover" : "idle");
                      }
                    }}
                    onFileSelect={(file) => void carregarPlaybookLocal(file)}
                    onAnalisar={() => void analisarPlaybookComMistral()}
                  />
                </div>
              ) : null}
              {somentePlaybook && playbookConteudoAnalise.trim() ? (
                <PlaybookFlowStatusBanner status={playbookFlowStatus} compact />
              ) : null}

              {!somentePlaybook && carregando ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando cargos...</p>
              ) : !somentePlaybook && erroCargos ? (
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
              ) : !somentePlaybook ? (
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
                            {ativo && <span style={{ color: "#c9a24a", fontSize: 16, flexShrink: 0 }}>âœ“</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {passo === 2 && (cargoSelecionado || somentePlaybook) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Identidade do agente
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  {somentePlaybook
                    ? "Nome e mercados â€” comportamento vem do playbook no bucket."
                    : "Campos fixos do cargo, nome e mercados."}
                </p>
              </div>

              {!somentePlaybook && cargoSelecionado ? (
              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 12px" }}>
                  Fixo do cargo ðŸ”’
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 }}>
                      NÃ­vel
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
                      <span style={{ color: "#8b949e", fontSize: 13 }}>â€”</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                    InferÃªncia: <strong style={{ color: "#8b949e" }}>Mistral</strong> (Agno). Modelo efectivo em{" "}
                    <code style={{ fontSize: 11 }}>MISTRAL_MODEL</code> no servidor â€” sem escolha por agente.
                  </p>
                </div>
              </div>
              ) : null}

              <div>
                <label
                  style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", display: "block", marginBottom: 8 }}
                >
                  Nome do agente <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={somentePlaybook ? "Ex: Maria, Mari..." : "Ex: Marina, SDR Apex, Analista Comercial..."}
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
                  Ajuste os 5 eixos para definir o estilo de comunicaÃ§Ã£o do agente.
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
                  Documentos (RAG)
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  O comportamento operacional (saudaÃ§Ã£o, perguntas essenciais e comprimento padrÃ£o) vem do{" "}
                  <strong style={{ color: "#adbac7" }}>cargo</strong>. Aqui anexe atÃ©{" "}
                  <strong style={{ color: "#adbac7" }}>{RAG_DOCS_LIMIT} documentos</strong> sobre produto ou
                  empresa para conhecimento factual (RAG).
                </p>
              </div>

              {cargoSelecionado ? (
                <div
                  style={{
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 700 }}>
                    PREVIEW DO CARGO (ATENDIMENTO)
                  </p>
                  {typeof cargoSelecionado.saudacao_cliente === "string" && cargoSelecionado.saudacao_cliente.trim() ? (
                    <p style={{ margin: 0, color: "#adbac7", fontSize: 12, lineHeight: 1.5 }}>
                      <strong style={{ color: "#e6edf3" }}>SaudaÃ§Ã£o:</strong>{" "}
                      {cargoSelecionado.saudacao_cliente.trim()}
                    </p>
                  ) : (
                    <p style={{ margin: 0, color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                      Sem saudaÃ§Ã£o padrÃ£o definida no cargo.
                    </p>
                  )}
                  {typeof cargoSelecionado.comprimento_padrao === "string" && cargoSelecionado.comprimento_padrao.trim() ? (
                    <p style={{ margin: 0, color: "#adbac7", fontSize: 12, lineHeight: 1.5 }}>
                      <strong style={{ color: "#e6edf3" }}>Comprimento:</strong>{" "}
                      {cargoSelecionado.comprimento_padrao.trim()}
                    </p>
                  ) : null}
                  {cargoSelecionado.usar_perguntas_essenciais === true ? (
                    <div>
                      <p style={{ margin: "0 0 4px", color: "#e6edf3", fontSize: 12, fontWeight: 700 }}>
                        Perguntas essenciais
                      </p>
                      {splitLinesLite(cargoSelecionado.perguntas_essenciais).length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: 18, color: "#adbac7", fontSize: 12, lineHeight: 1.5 }}>
                          {splitLinesLite(cargoSelecionado.perguntas_essenciais).slice(0, 5).map((pergunta, idx) => (
                            <li key={`${pergunta}-${idx}`}>{pergunta}</li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ margin: 0, color: "#8b949e", fontSize: 12 }}>
                          Ativado no cargo, mas sem perguntas cadastradas.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#8b949e", fontSize: 12 }}>
                      Este cargo nÃ£o exige sequÃªncia de perguntas essenciais.
                    </p>
                  )}
                </div>
              ) : null}

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                      Documentos para RAG (embeddings)
                    </p>
                    <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 12px", lineHeight: 1.55 }}>
                      Recomendado: subir atÃ© <strong style={{ color: "#adbac7" }}>{RAG_DOCS_LIMIT} ficheiros</strong>{" "}
                      sobre produto, serviÃ§os e empresa. Primeiro ficam sÃ³ no navegador; o envio ao servidor exige um
                      agente criado. Pode indexar jÃ¡ com <strong style={{ color: "#adbac7" }}>Processar embeddings</strong>{" "}
                      (cria o agente se ainda nÃ£o existir) ou deixar na fila e concluir no passo{" "}
                      <strong style={{ color: "#adbac7" }}>Ferramentas</strong>. Formatos:{" "}
                      <strong style={{ color: "#adbac7" }}>{RAG_FORMATOS_RESUMO}</strong>.
                    </p>
                  </div>
                  <span
                    style={{
                      color: ragPendentes.length >= RAG_DOCS_LIMIT ? "#f0b429" : "#8b949e",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ragPendentes.length}/{RAG_DOCS_LIMIT}
                  </span>
                </div>

                <label
                  style={{
                    display: "block",
                    border: "1px dashed #3d444d",
                    borderRadius: 10,
                    padding: "14px 12px",
                    cursor: ragPendentes.length >= RAG_DOCS_LIMIT ? "not-allowed" : "pointer",
                    color: ragPendentes.length >= RAG_DOCS_LIMIT ? "#6e7781" : "#58a6ff",
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    background: "#0d1117",
                    opacity: ragPendentes.length >= RAG_DOCS_LIMIT ? 0.7 : 1,
                  }}
                >
                  {ragPendentes.length >= RAG_DOCS_LIMIT
                    ? "Limite de documentos atingido"
                    : "Adicionar documento Ã  fila"}
                  <input
                    type="file"
                    accept={RAG_ACCEPT_ATTR}
                    disabled={ragPendentes.length >= RAG_DOCS_LIMIT}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      adicionarRagPendente(file);
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void prepararEmbeddingsFila()}
                  disabled={ragPreparando || ragPendentes.length === 0}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    border: "1px solid #30363d",
                    background: ragPreparando ? "#21262d" : "#0b5ed722",
                    color: ragPreparando ? "#8b949e" : "#58a6ff",
                    cursor: ragPreparando || ragPendentes.length === 0 ? "not-allowed" : "pointer",
                    opacity: ragPreparando || ragPendentes.length === 0 ? 0.7 : 1,
                  }}
                >
                  {ragPreparando
                    ? "A enviar e indexar..."
                    : ragPreparados
                      ? "Reprocessar embeddings"
                      : "Processar embeddings agora"}
                </button>

                {ragPendenteErro ? (
                  <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>{ragPendenteErro}</p>
                ) : null}
                <RagErroAjuda mensagem={ragPendenteErro} />

                {agenteSlugCriado ? (
                  <p
                    style={{
                      color: "#3fb950",
                      fontSize: 12,
                      margin: "10px 0 0",
                      lineHeight: 1.5,
                      background: "rgba(63,185,80,0.08)",
                      border: "1px solid rgba(63,185,80,0.35)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    Agente <strong style={{ color: "#e6edf3" }}>{agenteSlugCriado}</strong> criado. Use{" "}
                    <strong style={{ color: "#e6edf3" }}>PrÃ³ximo</strong> para RevisÃ£o â†’ Ferramentas â†’ Materiais â†’ Canal.
                  </p>
                ) : null}

                {ragPendentes.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        background: "#21262d",
                        border: "1px solid #30363d",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width:
                            ragUploadTotal > 0
                              ? `${Math.min(100, Math.round((ragUploadDone / Math.max(1, ragUploadTotal)) * 100))}%`
                              : ragPreparados
                                ? "35%"
                                : "0%",
                          height: "100%",
                          background:
                            ragUploadTotal > 0
                              ? "linear-gradient(90deg, #238636 0%, #3fb950 100%)"
                              : "linear-gradient(90deg, #1f6feb 0%, #58a6ff 100%)",
                          transition: "width 180ms ease",
                        }}
                      />
                    </div>
                    <p style={{ color: "#8b949e", fontSize: 11, margin: "6px 0 0" }}>
                      {ragUploadTotal > 0
                        ? `Progresso do processamento: ${ragUploadDone}/${ragUploadTotal}`
                        : ragPendentes.some((i) => i.status === "concluido")
                          ? "Documentos indexados no servidor."
                          : ragPendentes.every((i) => i.status === "na_fila")
                            ? "Na fila local â€” clique em Â«Processar embeddings agoraÂ» ou conclua com Â«Criar agenteÂ»."
                            : "Aguardando processamento."}
                    </p>
                  </div>
                ) : null}

                {ragPendentes.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                    {ragPendentes.map((item, idx) => (
                      <div
                        key={ragFileKey(item.file)}
                        style={{
                          border: "1px solid #30363d",
                          borderRadius: 12,
                          padding: 12,
                          background: "#0d1117",
                          display: "grid",
                          gridTemplateColumns: "44px 1fr auto",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            background: "#21262d",
                            border: "1px solid #30363d",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#8b949e",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {ragDocExt(item.file.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              color: "#e6edf3",
                              fontSize: 13,
                              fontWeight: 800,
                              margin: "0 0 4px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={item.file.name}
                          >
                            {item.file.name}
                          </p>
                          <p style={{ color: "#8b949e", fontSize: 11, margin: 0, lineHeight: 1.45 }}>
                            {formatBytes(item.file.size)} Â·{" "}
                            <span
                              style={{
                                color:
                                  item.status === "concluido"
                                    ? "#3fb950"
                                    : item.status === "erro"
                                      ? "#f85149"
                                      : item.status === "processando"
                                        ? "#58a6ff"
                                        : item.status === "preparado"
                                          ? "#c9a24a"
                                          : "#8b949e",
                              }}
                            >
                              {item.status === "concluido"
                                ? "CONCLUÃDO"
                                : item.status === "erro"
                                  ? "ERRO"
                                  : item.status === "processando"
                                    ? "PROCESSANDO"
                                    : item.status === "preparado"
                                      ? "PREPARADO"
                                      : "NA FILA"}
                            </span>
                            {item.status === "na_fila"
                              ? " â€” ainda sÃ³ no navegador"
                              : item.status === "preparado"
                                ? " â€” pronto para envio"
                                : ""}
                          </p>
                          {item.mensagem ? (
                            <p style={{ color: "#8b949e", fontSize: 11, margin: "4px 0 0", lineHeight: 1.4 }}>
                              {item.mensagem}
                            </p>
                          ) : null}
                          {item.status === "erro" && item.mensagem ? (
                            <RagErroAjuda mensagem={item.mensagem} />
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removerRagPendentePorIndice(idx)}
                          style={{
                            border: "1px solid #30363d",
                            background: "transparent",
                            color: "#f85149",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#6e7781", fontSize: 12, margin: "12px 0 0" }}>
                    Nenhum documento na fila. Opcional, mas recomendado para enriquecer respostas com dados do seu produto/empresa.
                  </p>
                )}
              </div>
            </div>
          )}

          {passo === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Ferramentas Hub
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  Ligue o motor e active as funÃ§Ãµes que o Mistral pode pedir ao servidor (lead na sessÃ£o). Inclui o catÃ¡logo{" "}
                  <strong style={{ color: "#aebccf" }}>builtin</strong> e as ferramentas{" "}
                  <strong style={{ color: "#c9a24a" }}>custom</strong> activas do tenant. Se escolheu{" "}
                  <strong style={{ color: "#aebccf" }}>WhatsApp</strong> no passo anterior, as sugestÃµes para esse canal
                  aparecem em destaque.
                </p>
              </div>
              <AgenteFerramentasIaBlock
                motorHabilitado={motorFerramentasHub}
                onMotorChange={setMotorFerramentasHub}
                mistralSyncHabilitado={mistralProvisionar}
                onMistralSyncChange={setMistralProvisionar}
                usoFerramentas={mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa)}
                onUsoChange={(id, ativo) =>
                  setUsoFerramentasIa((prev) => ({
                    ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                    [id]: ativo,
                  }))
                }
                customCatalog={catalogoCustomFerramentasWizard}
                destacarWhatsApp={modoOperacao === "canal_whatsapp"}
              />
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

              {agenteSlugCriado ? (
                <p style={{ color: "#3fb950", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
                  Agente <strong style={{ color: "#e6edf3" }}>{agenteSlugCriado}</strong> jÃ¡ foi criado (ex.: ao
                  processar documentos RAG). Grave as ferramentas abaixo e continue para Materiais e Canal.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (agenteSlugCriado) {
                    void (async () => {
                      setCriando(true);
                      setErro("");
                      const ok = await sincronizarWizardNoAgente(agenteSlugCriado);
                      setCriando(false);
                      if (ok) setPasso(7);
                    })();
                    return;
                  }
                  setShowConfirm(true);
                }}
                disabled={(!somentePlaybook && !cargoSelecionado) || !nome.trim() || criando}
                style={{
                  padding: "14px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor:
                    (!somentePlaybook && !cargoSelecionado) || !nome.trim() || criando
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    (!somentePlaybook && !cargoSelecionado) || !nome.trim() || criando ? 0.4 : 1,
                }}
              >
                {criando
                  ? "A gravarâ€¦"
                  : agenteSlugCriado
                    ? "Continuar â†’ Materiais"
                    : "Criar agente"}
              </button>
            </div>
          )}

          {passo === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  RevisÃ£o
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Confira identidade, cargo e como o copiloto opera (canal e ciclos). Depois configure as ferramentas
                  e crie o agente.
                </p>
                {ragPendentes.some((i) => i.status === "na_fila" || i.status === "preparado") ? (
                  <p style={{ color: "#c9a24a", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Documentos RAG pendentes:{" "}
                    <strong style={{ color: "#e6edf3" }}>
                      {ragPendentes.filter((i) => i.status !== "concluido").length}
                    </strong>{" "}
                    (serÃ£o indexados ao confirmar a criaÃ§Ã£o do agente, se ainda nÃ£o processou no passo Documentos).
                  </p>
                ) : ragPendentes.some((i) => i.status === "concluido") ? (
                  <p style={{ color: "#3fb950", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Documentos RAG jÃ¡ indexados nesta sessÃ£o.
                  </p>
                ) : null}
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

              {cargoSelecionado && cargoModelosForaDaListaHub(cargoSelecionado).length > 0 && (
                <div
                  style={{
                    background: "#3d2f0018",
                    border: "1px solid #bb800966",
                    borderRadius: 12,
                    padding: "12px 16px",
                    color: "#d4a72c",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#e3b341" }}>Modelo de IA no catÃ¡logo</strong>
                  <br />
                  Este cargo tem IDs de modelo que o Postgres nÃ£o aceita na tabela de identidade. Ao criar o agente, o
                  servidor grava <strong>mistral</strong> nesses campos (sinÃ³nimo do modelo definido em{" "}
                  <code style={{ fontSize: 11 }}>MISTRAL_MODEL</code> no servidor). Atualize o catÃ¡logo se quiser
                  manter outro fabricante explicitamente.
                </div>
              )}

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
                {[
                  { label: "Nome", value: nome || "â€”" },
                  { label: "Mercados", value: mercados.join(", ") || "â€”" },
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
                  COMO O COPILOTO RODA
                </p>
                <p style={{ color: "#6e7781", fontSize: 12, margin: "0 0 14px", lineHeight: 1.5 }}>
                  Aqui vocÃª define se o modelo <strong style={{ color: "#aebccf" }}>atende no canal</strong> (WhatsApp
                  legado) ou se fica sÃ³ em <strong style={{ color: "#aebccf" }}>operaÃ§Ãµes internas</strong> por ciclos.
                  Por padrÃ£o recomendamos o copiloto interno; use o canal quando precisar de fila de atendimento ao vivo.
                </p>

                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                  ONDE O AGENTE OPERA
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {(
                    [
                      {
                        id: "jobs_internos" as const,
                        Icon: Zap,
                        titulo: MODO_OPERACAO_LABEL.jobs_internos,
                        texto: MODO_OPERACAO_DESCRICAO.jobs_internos,
                        badge: "Recomendado",
                      },
                      {
                        id: "canal_whatsapp" as const,
                        Icon: MessageSquare,
                        titulo: MODO_OPERACAO_LABEL.canal_whatsapp,
                        texto: MODO_OPERACAO_DESCRICAO.canal_whatsapp,
                        badge: null,
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
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              color: "#e6edf3",
                              fontWeight: 700,
                              fontSize: 13,
                              marginBottom: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {opt.titulo}
                            {opt.badge ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#23863633",
                                  color: "#3fb950",
                                  border: "1px solid #23863666",
                                }}
                              >
                                {opt.badge}
                              </span>
                            ) : null}
                          </span>
                          <span style={{ color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                            {opt.texto}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {modoOperacao === "canal_whatsapp" ? (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(248,187,92,0.35)",
                      background: "rgba(248,187,92,0.08)",
                      color: "#e6c06a",
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "#e6c06a" }}>Canal WhatsApp:</strong> recomendamos activar resumo do lead,
                    memÃ³rias e registo de nota. No passo seguinte (<strong style={{ color: "#c9a24a" }}>Ferramentas</strong>
                    ) estas opÃ§Ãµes aparecem em destaque â€” avance com <strong style={{ color: "#c9a24a" }}>PrÃ³ximo</strong>.
                  </div>
                ) : null}

                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                  TIPO DE EXECUÃ‡ÃƒO DO CICLO PADRÃƒO
                </p>
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
                  {modoOperacao === "jobs_internos" ? (
                    <>
                      O modelo serÃ¡ salvo como <strong style={{ color: "#c9a24a" }}>jobs_internos</strong> e jÃ¡
                      provisiona um ciclo padrÃ£o em <code style={{ color: "#8b949e" }}>hub_ciclos_ia</code>.
                    </>
                  ) : (
                    <>
                      O modelo serÃ¡ salvo como <strong style={{ color: "#c9a24a" }}>canal_whatsapp</strong> â€”
                      modo <strong style={{ color: "#c9a24a" }}>atendimento no canal</strong> â€” e provisiona ciclo de{" "}
                      <strong style={{ color: "#c9a24a" }}>gatilho por interaÃ§Ã£o</strong> (cada mensagem no webhook).
                    </>
                  )}
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {(
                    [
                      { id: "provisionar" as const, label: "Criar ciclo do assistente" },
                      { id: "somente_vincular" as const, label: "SÃ³ associar existentes" },
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
                        Para atendimento no WhatsApp (legado), o ciclo padrÃ£o Ã©{" "}
                        <strong style={{ color: "#c9a24a" }}>sob interaÃ§Ã£o</strong> (gatilho a cada mensagem no canal).
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
                                  titulo: "Sob interaÃ§Ã£o",
                                  texto:
                                    "Dispara por interaÃ§Ã£o no canal; nÃ£o depende de cron para cada mensagem.",
                                },
                              ] as const)
                            : ([
                                {
                                  id: "tempo_real" as const,
                                  Icon: Zap,
                                  titulo: "AutomÃ¡tico contÃ­nuo",
                                  texto:
                                    "Motor interno em ciclo contÃ­nuo. Ãštil para supervisÃ£o e rotinas sem horÃ¡rio fixo.",
                                },
                                {
                                  id: "agenda" as const,
                                  Icon: Clock,
                                  titulo: "HorÃ¡rio fixo / recorrente",
                                  texto:
                                    "Ciclo programado (inicia em pausa) com intervalo abaixo; depois configure cron/dispatch e ative.",
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
                          <option value={1440}>â‰ˆ 1 vez por dia</option>
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
                    <p style={{ color: "#6e7781", fontSize: 12, margin: 0 }}>A carregar ciclosâ€¦</p>
                  ) : hubCiclosLista.length === 0 ? (
                    <p style={{ color: "#6e7781", fontSize: 12, margin: 0 }}>
                      Nenhum ciclo em hub_ciclos_ia. Crie-os em CRM â†’ Ciclos IA.
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
                                {c.nome || "â€”"}
                              </span>
                              <span style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.45 }}>
                                {c.agente_slug} Â· {hubCicloTipoLabel(c.tipo)}
                                {!c.ativo ? " Â· inativo" : ""}
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

              {cargoSelecionado ? (
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
                    RESUMO DO CARGO (ATENDIMENTO)
                  </p>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #30363d" }}>
                    <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 4px" }}>SaudaÃ§Ã£o</p>
                    <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                      {typeof cargoSelecionado.saudacao_cliente === "string" && cargoSelecionado.saudacao_cliente.trim()
                        ? cargoSelecionado.saudacao_cliente.trim()
                        : "Sem saudaÃ§Ã£o padrÃ£o no cargo."}
                    </p>
                  </div>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #30363d" }}>
                    <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 4px" }}>Comprimento</p>
                    <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                      {typeof cargoSelecionado.comprimento_padrao === "string" && cargoSelecionado.comprimento_padrao.trim()
                        ? cargoSelecionado.comprimento_padrao.trim()
                        : "Sem comprimento padrÃ£o definido no cargo."}
                    </p>
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <p style={{ color: "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 4px" }}>Perguntas essenciais</p>
                    {cargoSelecionado.usar_perguntas_essenciais === true ? (
                      splitLinesLite(cargoSelecionado.perguntas_essenciais).length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: 18, color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                          {splitLinesLite(cargoSelecionado.perguntas_essenciais).slice(0, 5).map((p, idx) => (
                            <li key={`${p}-${idx}`}>{p}</li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                          Ativado no cargo, mas sem perguntas preenchidas.
                        </p>
                      )
                    ) : (
                      <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
                        Este cargo nÃ£o exige sequÃªncia de perguntas.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {passo === 7 && agenteSlugCriado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Materiais (playbook)
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  Gera um ficheiro no Storage com a configuraÃ§Ã£o deste agente, para ferramentas ou equipas que precisem
                  do playbook num URL estÃ¡vel. Se jÃ¡ passou pelo passo Canal (WhatsApp), use <strong style={{ color: "#aebccf" }}>â† Anterior</strong> a partir desse ecrÃ£ para voltar aqui antes de concluir.
                </p>
              </div>

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 10px" }}>
                  AGENTE CRIADO
                </p>
                <p style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700, margin: "0 0 8px", wordBreak: "break-all" }}>
                  {nome || agenteSlugCriado}{" "}
                  <span style={{ color: "#6e7781", fontWeight: 600, fontSize: 12 }}>({agenteSlugCriado})</span>
                </p>
                <a
                  href={`/crm/agentes/${encodeURIComponent(agenteSlugCriado)}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#58a6ff",
                    textDecoration: "none",
                  }}
                >
                  Abrir ficha do agente â†’
                </a>
              </div>

              {playbookMetaLoading && (
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>A ler estado do playbookâ€¦</p>
              )}

              {playbookErro ? (
                <p
                  style={{
                    color: "#f85149",
                    fontSize: 13,
                    margin: 0,
                    background: "#f8514918",
                    border: "1px solid #f8514944",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  {playbookErro}
                </p>
              ) : null}

              {somentePlaybook && playbookUploadStatus === "sucesso" && playbookPublicUrl ? (
                <p
                  style={{
                    color: "#3fb950",
                    fontSize: 12,
                    margin: 0,
                    background: "#23863618",
                    border: "1px solid #23863644",
                    borderRadius: 8,
                    padding: "10px 14px",
                    lineHeight: 1.5,
                  }}
                >
                  Playbook publicado automaticamente ao criar o agente. Pode reenviar outro arquivo abaixo se quiser
                  substituir.
                </p>
              ) : null}
              {playbookConteudoAnalise.trim() ? (
                <PlaybookFlowStatusBanner status={playbookFlowStatus} compact />
              ) : null}

              <PlaybookUploadAnalisePanel
                inputId={PLAYBOOK_INPUT_POS}
                uploadStatus={playbookUploadStatus}
                uploadMensagem={playbookUploadMensagem}
                uploadPct={playbookUploadPct}
                arquivoNome={playbookArquivoNome}
                conteudoPreview={playbookConteudoPreview}
                conteudoCarregado={!!playbookConteudoAnalise.trim()}
                analiseLoading={playbookAnaliseLoading}
                analisePct={playbookAnalisePct}
                analiseErro={playbookAnaliseErro}
                analiseResultado={playbookAnaliseResultado}
                dropzoneBorder={playbookDropzoneBorder}
                dropzoneBg={playbookDropzoneBg}
                onHoverChange={(hover) => {
                  if (playbookUploadStatus !== "enviando") {
                    setPlaybookUploadStatus(hover ? "hover" : "idle");
                  }
                }}
                onFileSelect={(file) => void salvarPlaybookPorUpload(file)}
                onAnalisar={() => void analisarPlaybookComMistral()}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => void aplicarTemplatePadraoV1NoWizard()}
                  disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #30363d",
                    background: "#21262d",
                    color: "#c9d1d9",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor:
                      playbookUploadStatus === "enviando" || playbookAnaliseLoading
                        ? "not-allowed"
                        : "pointer",
                    opacity: playbookUploadStatus === "enviando" || playbookAnaliseLoading ? 0.65 : 1,
                  }}
                >
                  Aplicar template padrao v1
                </button>
              </div>

              {!playbookMetaLoading && !playbookErro && playbookPublicUrl ? (
                <div
                  style={{
                    background: "#23863618",
                    border: "1px solid #23863644",
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 6px" }}>
                    PLAYBOOK PÃšBLICO
                  </p>
                  <a
                    href={playbookPublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#3fb950", fontSize: 13, wordBreak: "break-all" }}
                  >
                    {playbookPublicUrl}
                  </a>
                </div>
              ) : !playbookMetaLoading && !playbookErro ? (
                <p style={{ color: "#6e7781", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  Ainda nÃ£o hÃ¡ playbook no Storage para este agente. Use o botÃ£o abaixo para gerar.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void gerarPlaybookNoStorage()}
                disabled={playbookGerando || playbookMetaLoading}
                style={{
                  padding: "14px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#c9a24a",
                  cursor: playbookGerando || playbookMetaLoading ? "wait" : "pointer",
                  opacity: playbookGerando || playbookMetaLoading ? 0.65 : 1,
                }}
              >
                {playbookGerando ? "A gerar playbookâ€¦" : "Gerar playbook no Storage"}
              </button>

              {ragPosCriacaoAviso ? (
                <div>
                  <p
                    style={{
                      color: "#f0b429",
                      fontSize: 12,
                      margin: 0,
                      lineHeight: 1.55,
                      background: "rgba(240,180,41,0.1)",
                      border: "1px solid rgba(240,180,41,0.35)",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    {ragPosCriacaoAviso}
                  </p>
                  <RagErroAjuda mensagem={ragPosCriacaoAviso} />
                </div>
              ) : null}
            </div>
          )}

          {passo === 8 && agenteSlugCriado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Canal
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  {modoOperacao === "canal_whatsapp"
                    ? "Passo 1: regiÃ£o + criar instÃ¢ncia UAZAPI. Passo 2 (opcional agora): QR ou cÃ³digo para ligar o telefone."
                    : "Este agente estÃ¡ em modo copiloto interno (jobs por ciclo). NÃ£o hÃ¡ WhatsApp neste fluxo â€” pode concluir e gerir ciclos na Central ou na ficha do agente."}
                </p>
              </div>

              {ragPosCriacaoAviso ? (
                <div>
                  <p
                    style={{
                      color: "#f0b429",
                      fontSize: 12,
                      margin: 0,
                      lineHeight: 1.55,
                      background: "rgba(240,180,41,0.1)",
                      border: "1px solid rgba(240,180,41,0.35)",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    {ragPosCriacaoAviso}
                  </p>
                  <RagErroAjuda mensagem={ragPosCriacaoAviso} />
                </div>
              ) : null}

              {modoOperacao === "canal_whatsapp" && hubCicloEstrategia === "somente_vincular" ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(201,162,74,0.45)",
                    background: "rgba(201,162,74,0.08)",
                    color: "#e6c06a",
                    fontSize: 12,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: "#c9a24a" }}>Ciclos vinculados:</strong> associou ciclos existentes da Central a
                  este agente. Confirme no painel UAZAPI que o <strong style={{ color: "#e6edf3" }}>webhook</strong> aponta
                  para <code style={{ fontSize: 11, color: "#93c5fd" }}>/api/whatsapp/webhook</code> e que a instÃ¢ncia
                  abaixo fica <strong style={{ color: "#e6edf3" }}>connected</strong> â€” sÃ³ assim as mensagens disparam a
                  IA neste modelo.
                </div>
              ) : null}

              {modoOperacao === "canal_whatsapp" ? (
                <>
                  {syncCanalLoading ? (
                    <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
                      A gravar modo WhatsApp e configuraÃ§Ã£o no agenteâ€¦
                    </p>
                  ) : null}
                  <AgenteUazapiBlock
                    agenteSlug={agenteSlugCriado}
                    bloqueado={syncCanalLoading}
                    snapshot={
                      uazapiSnap ?? {
                        uazapi_instance_id: null,
                        uazapi_instance_name: null,
                        uazapi_connection_status: null,
                        uazapi_has_instance_token: false,
                      }
                    }
                    onSnapshotPatch={(patch) =>
                      setUazapiSnap((prev) => ({
                        ...(prev ?? {
                          uazapi_instance_id: null,
                          uazapi_instance_name: null,
                          uazapi_connection_status: null,
                          uazapi_has_instance_token: false,
                        }),
                        ...patch,
                      }))
                    }
                  />
                </>
              ) : (
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                  <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                    Para ativar WhatsApp mais tarde, abra a ficha do agente e altere o modo de operaÃ§Ã£o / ciclo ou use o
                    bloco UAZAPI na Ã¡rea de integraÃ§Ãµes.
                  </p>
                </div>
              )}
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
                â† Anterior
              </button>
            )}
            {passo < 6 && (
              <button
                type="button"
                onClick={() => setPasso((p) => p + 1)}
                disabled={
                  passo === 1 ? passo1AvancarBloqueado : passo === 2 ? !nome.trim() : false
                }
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
                    (passo === 1 && passo1AvancarBloqueado) || (passo === 2 && !nome.trim())
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    (passo === 1 && passo1AvancarBloqueado) || (passo === 2 && !nome.trim()) ? 0.4 : 1,
                }}
              >
                PrÃ³ximo â†’
              </button>
            )}
            {passo === 7 && agenteSlugCriado ? (
              <button
                type="button"
                onClick={() => setPasso(8)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor: "pointer",
                }}
              >
                Continuar â†’ Canal
              </button>
            ) : null}
            {passo === 8 ? (
              <button
                type="button"
                onClick={concluirPosCriacao}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor: "pointer",
                }}
              >
                Concluir
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <CrmConfirmDialog
        open={dialogFecharAssistente}
        title="Fechar o assistente?"
        confirmLabel="Fechar"
        cancelLabel="Continuar no assistente"
        onCancel={() => setDialogFecharAssistente(false)}
        onConfirm={() => {
          setDialogFecharAssistente(false);
          fecharAssistente();
        }}
      >
        <p style={{ margin: 0, color: "#9cb0c9", fontSize: 13, lineHeight: 1.55 }}>
          O agente jÃ¡ foi criado. Pode ligar o WhatsApp, gerar playbook e ajustar o canal mais tarde na ficha do
          modelo.
        </p>
      </CrmConfirmDialog>
    </div>
  );
}

