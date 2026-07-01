"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Clock, Mail, MessageSquare, Webhook, Zap } from "lucide-react";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import {
  MODO_OPERACAO_DESCRICAO,
  MODO_OPERACAO_LABEL,
  agenteEhModoCanal,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import {
  AgenteFerramentasIaBlock,
  type CatalogoFerramentaCustomLite,
  type CatalogoFerramentaExternaLite,
} from "@/components/crm/AgenteFerramentasIaBlock";
import { fetchHubFerramentasExternas } from "@/lib/hub/fetch-hub-ferramentas-externas";
import { buildCatalogoIntegradorFerramentasCompleto } from "@/lib/hub/integrador-catalogo-ui";
import {
  AgenteEmailConnectBlock,
  type AgenteEmailSnapshot,
} from "@/components/crm/AgenteEmailConnectBlock";
import {
  AgenteUazapiBlock,
  type AgenteUazapiSnapshot,
} from "@/components/crm/AgenteUazapiBlock";
import {
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasWhatsappCanal,
  pacoteUsoFerramentasSuperagenteInterno,
} from "@/lib/hub/agente-ferramentas-registry";
import type { SuperagenteSkill } from "@/lib/hub/superagente/types";
import { WA_PRESET_CARGO_SLUG } from "@/lib/hub/presets/wa-conversacao-preset-shared";
import {
  AGENDA_INTERVALO_OPCOES,
  cronDiarioUtcFromHoraLocalBr,
  type AgendaCicloModo,
} from "@/lib/hub/ciclo-agenda-cron";
import { hubModeloExibicaoProduto, isHubModeloIdDbCompatible } from "@/lib/ia/hub-model-defaults";
import {
  PlaybookUploadAnalisePanel,
  type PlaybookAnaliseResultado,
  type PlaybookUploadStatus,
} from "@/components/crm/PlaybookUploadAnalisePanel";
import { PlaybookFlowStatusBanner } from "@/components/crm/PlaybookFlowStatusBanner";
import {
  assessPlaybookFlowInMarkdown,
  agenteUsaFluxoWhatsappPlaybook,
  playbookFlowReady,
} from "@/lib/playbook/playbook-flow-ui";
import { PLAYBOOK_EXEMPLO_ARQUIVO, PLAYBOOK_EXEMPLO_MD_URL } from "@/lib/playbook/playbook-exemplo";
import { isEmailChannelEnabledClient } from "@/lib/feature-flags";
import {
  RAG_ACCEPT_ATTR,
  RAG_EXEMPLO_MD_URL,
  RAG_FORMATOS_RESUMO,
  ragErroPdfSemTexto,
  ragExtensaoAceita,
} from "@/lib/hub/rag-formatos";
import { CONHECIMENTO_TITULO_INSERT } from "@/lib/hub/conhecimento-secoes";
import { prefixoMercadoParaGravacao } from "@/lib/crm/mercado-agente";
import {
  AGENTE_WIZARD_PASSO_0,
  AGENTE_WIZARD_STEP_INTRO,
  agenteWizardPasso8Descricao,
  agenteWizardPasso8Intro,
  modoInstrucaoWizardResumo,
  modoOperacaoWizardResumo,
  WIZARD_TIPO_LABEL,
  type WizardTipoAgente,
} from "@/lib/hub/agente-wizard-copy";
import { CARGO_LABEL_PLAYBOOK_ONLY } from "@/lib/hub/agente-instrucao-modo";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import { RF } from "@/lib/crm/crm-retrofit-dark-theme";
import { createAgenteWizardTheme } from "@/lib/crm/agente-wizard-theme";
import { gerarPersonalidadeAgente } from "@/lib/hub/agente-personalidade-eixos";
import { AgentePersonalidadeEixosPanel } from "@/components/crm/AgentePersonalidadeEixosPanel";
import { AgenteGoogleWorkspaceBlock } from "@/components/crm/AgenteGoogleWorkspaceBlock";
import { AgenteWizardIntegracoesInternoPanel } from "@/components/crm/AgenteWizardIntegracoesInternoPanel";
import { AgenteFollowupBlock } from "@/components/crm/AgenteFollowupBlock";
import {
  agenteUsaFerramentasGoogle,
  agentePrecisaGoogleWorkspace,
  cargoRecomendaGoogleWorkspace,
  patchFerramentasGoogleAgendamento,
  readWizardOAuthResume,
  clearWizardOAuthResume,
  pathnameWithStrippedWizardParams,
} from "@/lib/hub/agente-wizard-google";

// --- Constants ---

/** Passos do assistente — após «Ferramentas» e criar agente, passos 7–9 são pós-criação (Canal / Google conforme tipo). */
const WIZARD_STEP_LABELS = [
  "Cargo",
  "Identidade",
  "Personalidade",
  "Conhecimento",
  "Revisão",
  "Ferramentas",
  "Materiais",
  "Canal",
  "Google",
] as const;

/** Passo 4 (playbook + RAG) só existe no fluxo de atendimento/canal. */
function wizardPassoAnterior(passo: number, interno: boolean): number {
  if (interno && passo === 6) return 2;
  if (interno && passo === 8) return 6;
  if (interno && passo === 5) return 8;
  if (interno && passo === 7) return 5;
  if (interno && passo === 5) return 3;
  return passo - 1;
}

function wizardPassoProximo(passo: number, interno: boolean): number {
  if (interno && passo === 2) return 6;
  if (interno && passo === 3) return 5;
  return passo + 1;
}

const WIZARD_CONHECIMENTO_SECOES = ["empresa", "servicos", "atendimento", "proibicoes"] as const;
type WizardConhecimentoSecaoId = (typeof WIZARD_CONHECIMENTO_SECOES)[number];

const WIZARD_CONHECIMENTO_PLACEHOLDERS: Record<WizardConhecimentoSecaoId, string> = {
  empresa: "Quem é a empresa, o que faz, diferenciais e público-alvo...",
  servicos: "Serviços ou produtos, faixas de preço, condições e escopo...",
  atendimento: "Tom, saudação, perguntas-chave e como conduzir a conversa...",
  proibicoes: "Promessas, temas ou ações que o agente nunca deve fazer...",
};

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  "Operações": "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

/** Modelos definidos no catálogo do cargo — alguns IDs antigos são normalizados para `mistral` no servidor. */
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
  saudação_cliente?: string;
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
  if (tipo === "continuo") return "contínuo";
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
  const formato = /formato não suportado|não indexável/i.test(mensagem);
  if (!pdf && !formato) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(45,106,79,0.35)",
        background: "rgba(45,106,79,0.08)",
        color: "#5d7a67",
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      {pdf ? (
        <p style={{ margin: "0 0 8px" }}>
          <strong style={{ color: "#2d6a4f" }}>PDF sem texto seleccionável.</strong> Muitos PDFs criados com
          &quot;Imprimir&quot; ou digitalizados não indexam. Use{" "}
          <a
            href={RAG_EXEMPLO_MD_URL}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2d6a4f", fontWeight: 700 }}
          >
            o ficheiro .md de exemplo
          </a>{" "}
          ou exporte o mesmo conteúdo em <strong style={{ color: "#0b2210" }}>.docx</strong> /{" "}
          <strong style={{ color: "#0b2210" }}>.md</strong>.
        </p>
      ) : null}
      {formato ? (
        <p style={{ margin: pdf ? 0 : "0 0 8px" }}>
          Formatos aceites: <strong style={{ color: "#0b2210" }}>{RAG_FORMATOS_RESUMO}</strong>.
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
      .split(/\n|•|- /)
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
    "Análise concluída sem resumo estruturado.";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [passo, setPasso] = useState(0);
  const [tipoWizard, setTipoWizard] = useState<WizardTipoAgente | null>(null);
  const [dialogFecharAssistente, setDialogFecharAssistente] = useState(false);
  const [cargoSelecionado, setCargoSelecionado] = useState<Cargo | null>(null);
  /** Harness interno: prompt + skills gerados a partir do cargo (sem playbook). */
  const [harnessPromptGerado, setHarnessPromptGerado] = useState("");
  const [harnessSkills, setHarnessSkills] = useState<SuperagenteSkill[]>([]);
  const [harnessGerando, setHarnessGerando] = useState(false);
  const [harnessGeradoComIa, setHarnessGeradoComIa] = useState(false);
  const [harnessErro, setHarnessErro] = useState("");
  const [harnessAprovado, setHarnessAprovado] = useState(false);
  const harnessReqRef = useRef(0);
  const harnessPasso6LoadRef = useRef(false);
  /** Sem cargo no catálogo — instruções só do playbook publicado no bucket. */
  const [somentePlaybook, setSomentePlaybook] = useState(false);
  /** Preset universal conversação WhatsApp (playbook + cargo + ciclos). */
  const [usarPresetWa, setUsarPresetWa] = useState(false);
  const [nome, setNome] = useState("");
  const [valores, setValores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [criando, setCriando] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [erro, setErro] = useState("");

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [filtroSegmento, setFiltroSegmento] = useState<string>("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>("");


  const wizardInterno = tipoWizard === "interno";
  const wizardCanal = tipoWizard === "canal";

  function aplicarTipoWizard(tipo: WizardTipoAgente) {
    setTipoWizard(tipo);
    setUsarPresetWa(false);
    if (tipo === "canal") {
      setModoOperacao("canal_whatsapp");
      setModoExecucao("interacao");
      setMotorFerramentasHub(true);
      setUsoFerramentasIa(mergeUsoFerramentasWhatsappCanal({}, "canal_whatsapp"));
      setFiltroSegmento("");
    } else {
      setModoOperacao("jobs_internos");
      setModoExecucao("interacao");
      setMotorFerramentasHub(true);
      setMistralProvisionar(true);
      setUsoFerramentasIa(pacoteUsoFerramentasSuperagenteInterno());
      setSomentePlaybook(false);
      if (!filtroSegmento) setFiltroSegmento("Operações");
    }
  }

  useEffect(() => {
    const resume = readWizardOAuthResume();
    if (resume?.agenteSlug) return;
    const wt = searchParams.get("wizard_tipo")?.trim().toLowerCase();
    if (wt === "canal" || wt === "interno") {
      aplicarTipoWizard(wt);
      setPasso(1);
    }
  }, [searchParams]);

  /** Padrão recomendado: copiloto interno (após escolha no passo 0). */
  const [modoOperacao, setModoOperacao] = useState<ModoOperacaoAgente>("jobs_internos");
  /** Onde/quando opera: gravado como hub_ciclos_ia. */
  const [modoExecucao, setModoExecucao] = useState<"interacao" | "tempo_real" | "agenda">("interacao");
  const [agendaIntervalMin, setAgendaIntervalMin] = useState<15 | 60 | 360 | 1440>(60);
  /** Ciclo programado: horário fixo diário (BR) ou intervalo em minutos. */
  const [agendaModo, setAgendaModo] = useState<AgendaCicloModo>("horario_fixo");
  const [agendaHoraLocal, setAgendaHoraLocal] = useState("08:00");

  /** `provisionar`: cria linha padrão + opcional vincular mais; `somente_vincular`: só atualiza slugs em hub_ciclos_ia. */
  const [hubCicloEstrategia, setHubCicloEstrategia] = useState<"provisionar" | "somente_vincular">(
    "provisionar"
  );
  const [hubCiclosLista, setHubCiclosLista] = useState<HubCicloPickListItem[]>([]);
  const [hubCiclosCarregando, setHubCiclosCarregando] = useState(false);
  const [hubCiclosVincularIds, setHubCiclosVincularIds] = useState<string[]>([]);
  const hubCiclosLoadRef = useRef(false);
  const googleAutoCanalRef = useRef(false);

  const [motorFerramentasHub, setMotorFerramentasHub] = useState(false);
  const [mistralProvisionar, setMistralProvisionar] = useState(false);
  const [usoFerramentasIa, setUsoFerramentasIa] = useState<Record<string, boolean>>(() =>
    mergeUsoFerramentasComPadraoPreservandoCustom({})
  );
  const [catalogoCustomFerramentasWizard, setCatalogoCustomFerramentasWizard] = useState<
    CatalogoFerramentaCustomLite[]
  >([]);
  const [catalogoExternaFerramentasWizard, setCatalogoExternaFerramentasWizard] = useState<
    CatalogoFerramentaExternaLite[]
  >([]);
  const [integradorConexoesWizard, setIntegradorConexoesWizard] = useState<
    Record<string, { configurado?: boolean; plataforma_ok?: boolean }>
  >({});
  const [googleOauthEmail, setGoogleOauthEmail] = useState<string | null>(null);

  const [erroCargos, setErroCargos] = useState(false);

  /** Preenchido após POST bem-sucedido em `/api/hub/agentes`. */
  const [agenteSlugCriado, setAgenteSlugCriado] = useState<string | null>(null);
  const [uazapiSnap, setUazapiSnap] = useState<AgenteUazapiSnapshot | null>(null);
  const [emailSnap, setEmailSnap] = useState<AgenteEmailSnapshot | null>(null);
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
  const playbookAnaliseAbortRef = useRef<AbortController | null>(null);
  const playbookAnaliseTickRef = useRef<number | null>(null);
  const playbookFlowStatus = assessPlaybookFlowInMarkdown(playbookConteudoAnalise);
  const whatsappFlowAgent = agenteUsaFluxoWhatsappPlaybook(modoOperacao);
  const [conhecimentoSecoes, setConhecimentoSecoes] = useState<
    Record<WizardConhecimentoSecaoId, string>
  >({
    empresa: "",
    servicos: "",
    atendimento: "",
    proibicoes: "",
  });

  /** Fila RAG local; indexada apos criar o agente (`processarFilaRagNoAgente`). */
  const [ragPendentes, setRagPendentes] = useState<RagFilaItem[]>([]);
  const [ragPendenteErro, setRagPendenteErro] = useState("");
  const [ragPosCriacaoAviso, setRagPosCriacaoAviso] = useState("");
  const [ragPreparando, setRagPreparando] = useState(false);
  const [ragPreparados, setRagPreparados] = useState(false);
  const [ragUploadTotal, setRagUploadTotal] = useState(0);
  const [ragUploadDone, setRagUploadDone] = useState(0);
  /** Passo Canal: PATCH do modo WhatsApp antes de acções UAZAPI. */
  const [syncCanalLoading, setSyncCanalLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const headers = await crmApiHeaders();
        const [r, externas, resInt] = await Promise.all([
          fetch("/api/hub/ferramentas-custom?all=true", { headers }),
          fetchHubFerramentasExternas(headers, false).catch(() => []),
          fetch("/api/hub/integradores", { headers }).catch(() => null),
        ]);
        const d: unknown = await r.json().catch(() => null);
        if (r.ok && Array.isArray(d)) {
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
        }
        setCatalogoExternaFerramentasWizard(
          externas
            .filter((x) => x.ativo)
            .map((x) => ({
              ferramenta_key: x.ferramenta_key,
              titulo: x.titulo,
              metodo_http: x.metodo_http,
              politica: x.politica,
              ativo: true,
              descricao_curta: x.descricao_curta ?? null,
            }))
        );
        if (resInt?.ok) {
          const j = (await resInt.json()) as {
            conexoes?: Record<string, { configurado?: boolean; plataforma_ok?: boolean }>;
          };
          setIntegradorConexoesWizard(
            j.conexoes && typeof j.conexoes === "object" ? j.conexoes : {}
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const refreshIntegradoresCatalogo = useCallback(async () => {
    try {
      const headers = await crmApiHeaders();
      const resInt = await fetch("/api/hub/integradores", { headers });
      if (!resInt.ok) return;
      const j = (await resInt.json()) as {
        conexoes?: Record<string, { configurado?: boolean; plataforma_ok?: boolean }>;
      };
      setIntegradorConexoesWizard(j.conexoes && typeof j.conexoes === "object" ? j.conexoes : {});
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!googleOauthEmail) return;
    void refreshIntegradoresCatalogo();
  }, [googleOauthEmail, refreshIntegradoresCatalogo]);

  const refreshSnapshotUazapi = useCallback(async () => {
    if (!agenteSlugCriado) return;
    try {
      const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}`, {
        headers: await crmApiHeaders(),
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

  const refreshSnapshotEmail = useCallback(async () => {
    if (!agenteSlugCriado) return;
    try {
      const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/email`, {
        headers: await crmApiHeaders(),
      });
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) return;
      setEmailSnap({
        email_from: typeof d.email_from === "string" ? d.email_from : null,
        email_from_name: typeof d.email_from_name === "string" ? d.email_from_name : null,
        email_inbound: typeof d.email_inbound === "string" ? d.email_inbound : null,
        email_ativo: d.email_ativo !== false,
      });
    } catch {
      /* ignore */
    }
  }, [agenteSlugCriado]);

  useEffect(() => {
    if (!isEmailChannelEnabledClient() && modoOperacao === "canal_email") {
      setModoOperacao("canal_whatsapp");
    }
  }, [modoOperacao]);

  useEffect(() => {
    if (passo === 8 && !agenteEhModoCanal(modoOperacao)) {
      setPasso(7);
    }
  }, [passo, modoOperacao]);

  useEffect(() => {
    if (passo !== 9) return;
    const recomenda = cargoRecomendaGoogleWorkspace({
      cargoTitulo: cargoSelecionado?.titulo,
      cargoDescricao: cargoSelecionado?.descricao_curta ?? cargoSelecionado?.descricao,
      cargoSlug: cargoSelecionado?.slug,
      cargoEspecialidade: cargoSelecionado?.especialidade,
      nomeAgente: nome,
    });
    if (
      !agentePrecisaGoogleWorkspace(usoFerramentasIa, {
        recomendaCargo: recomenda,
        modoCanal: false,
      })
    ) {
      setPasso(7);
    }
  }, [passo, usoFerramentasIa, cargoSelecionado, nome]);

  useEffect(() => {
    if (!agenteEhModoCanal(modoOperacao)) return;
    if (googleAutoCanalRef.current) return;
    googleAutoCanalRef.current = true;
    setMotorFerramentasHub(true);
    setUsoFerramentasIa((prev) =>
      patchFerramentasGoogleAgendamento(mergeUsoFerramentasComPadraoPreservandoCustom(prev))
    );
  }, [modoOperacao]);

  useEffect(() => {
    const resume = readWizardOAuthResume();
    const params = new URLSearchParams(searchParams.toString());
    const oauth = params.get("google_oauth");
    const wizardGoogle = params.get("wizard_google") === "1";
    const agenteParam = params.get("agente")?.trim() ?? "";
    const shouldStripUrl =
      Boolean(resume?.agenteSlug) ||
      oauth === "connected" ||
      (wizardGoogle && agenteParam.length > 0);

    if (resume?.agenteSlug) {
      setAgenteSlugCriado(resume.agenteSlug);
      setPasso(resume.passo);
    }
    if (oauth === "connected") {
      const email = params.get("email")?.trim();
      if (email) setGoogleOauthEmail(email);
      if (agenteParam) setAgenteSlugCriado(agenteParam);
      if (wizardGoogle && !resume) {
        setPasso(agenteEhModoCanal(modoOperacao) ? 8 : 9);
      }
    } else if (wizardGoogle && agenteParam && !resume) {
      setAgenteSlugCriado(agenteParam);
      setPasso(agenteEhModoCanal(modoOperacao) ? 8 : 9);
    }

    if (shouldStripUrl) {
      router.replace(pathnameWithStrippedWizardParams(pathname, params), { scroll: false });
    }
  }, [searchParams, modoOperacao, router, pathname]);

  useEffect(() => {
    if (passo !== 8 || !agenteSlugCriado || !agenteEhModoCanal(modoOperacao)) {
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
      if (isEmailChannelEnabledClient() && modoOperacao === "canal_email") await refreshSnapshotEmail();
    })();
    return () => {
      cancel = true;
    };
  }, [passo, agenteSlugCriado, modoOperacao, modoExecucao, refreshSnapshotEmail, refreshSnapshotUazapi]);

  useEffect(() => {
    if (passo !== 7 || !agenteSlugCriado || wizardInterno) return;
    let cancel = false;
    setPlaybookMetaLoading(true);
    setPlaybookErro("");
    (async () => {
      try {
        const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook`, {
          headers: await crmApiHeaders(),
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
  }, [passo, agenteSlugCriado, wizardInterno]);

  function adicionarRagPendente(file: File | null | undefined) {
    if (!file) return;
    if (!ragExtensaoAceita(file.name)) {
      setRagPendenteErro(`Formato não suportado. Formatos aceites: ${RAG_FORMATOS_RESUMO}.`);
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
      setRagPendenteErro("Este arquivo já está na lista.");
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
          headers: await crmApiHeaders(),
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
          ? `Documentos RAG: nenhum foi processado com sucesso. ${falhas.join(" · ")}`
          : `Documentos RAG: processamento parcial. ${falhas.join(" · ")}`
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
          setRagPendenteErro("Preencha cargo (ou modo só playbook) e nome antes de processar embeddings.");
          return;
        }
        setRagPreparados(true);
        // Cria o agente e indexa, mas mantém o utilizador no passo actual (Revisão/Ferramentas vêm a seguir).
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
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
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
          headers: await crmApiHeaders(),
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
      return "Formato inválido. Envie um arquivo .md ou .txt.";
    }
    if (file.size <= 0) return "Arquivo vazio. Escolha um arquivo com conteúdo.";
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
        setPlaybookUploadMensagem("Não foi possível extrair texto do arquivo.");
        setPlaybookUploadPct(0);
        setPlaybookArquivoPendente(null);
        return;
      }
      setPlaybookConteudoPreview(texto.slice(0, 2500));
      setPlaybookConteudoAnalise(texto);
      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem(
        somentePlaybook
          ? "Arquivo carregado. Analise o playbook antes de continuar."
          : "Arquivo carregado. Análise recomendada; pode avançar com o cargo selecionado."
      );
    } catch {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem("Falha ao ler o arquivo.");
      setPlaybookUploadPct(0);
      setPlaybookArquivoPendente(null);
    }
  }

  async function salvarPlaybookPorUpload(
    file: File,
    slugOverride?: string
  ): Promise<{ ok: boolean; path?: string; error?: string }> {
    const slugAlvo = slugOverride || agenteSlugCriado;
    if (!slugAlvo) {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem("Crie o agente antes de enviar o playbook.");
      return { ok: false, error: "Crie o agente antes de enviar o playbook." };
    }

    const erroValidacao = validarPlaybookArquivo(file);
    if (erroValidacao) {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadMensagem(erroValidacao);
      return { ok: false, error: erroValidacao };
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
        setPlaybookUploadMensagem("Não foi possível extrair texto do arquivo.");
        setPlaybookUploadPct(0);
        return { ok: false, error: "Não foi possível extrair texto do arquivo." };
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
        headers: await crmApiHeaders(),
        body: form,
      });

      // Fallback defensivo: se o endpoint novo não existir, tenta contrato JSON no endpoint atual.
      if (uploadRes.status === 404 || uploadRes.status === 405) {
        uploadRes = await fetch(`/api/hub/agentes/${encodeURIComponent(slugAlvo)}/playbook`, {
          method: "POST",
          headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
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
        return { ok: false, error: msg };
      }

      const retornoUrl =
        typeof payload.playbook_public_url === "string" && payload.playbook_public_url.trim()
          ? payload.playbook_public_url.trim()
          : null;
      const retornoPath =
        typeof payload.playbook_object_path === "string" && payload.playbook_object_path.trim()
          ? payload.playbook_object_path.trim()
          : undefined;
      if (retornoUrl) setPlaybookPublicUrl(retornoUrl);
      else await gerarPlaybookNoStorage();

      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem(
        retornoPath
          ? `Playbook gravado em hub-agent-playbooks/${retornoPath}`
          : "Playbook enviado com sucesso."
      );
      return { ok: true, path: retornoPath };
    } catch {
      setPlaybookUploadStatus("erro");
      setPlaybookUploadPct(0);
      setPlaybookUploadMensagem("Falha de rede ao enviar playbook.");
      return { ok: false, error: "Falha de rede ao enviar playbook." };
    }
  }

  function pararProgressoAnalisePlaybook() {
    if (playbookAnaliseTickRef.current != null) {
      window.clearInterval(playbookAnaliseTickRef.current);
      playbookAnaliseTickRef.current = null;
    }
  }

  function cancelarAnalisePlaybook() {
    playbookAnaliseAbortRef.current?.abort();
    playbookAnaliseAbortRef.current = null;
    pararProgressoAnalisePlaybook();
    setPlaybookAnaliseLoading(false);
    setPlaybookAnalisePct(0);
    setPlaybookAnaliseErro("Análise cancelada.");
  }

  function limparPlaybookCarregado() {
    if (playbookAnaliseLoading) cancelarAnalisePlaybook();
    setPlaybookArquivoNome("");
    setPlaybookArquivoPendente(null);
    setPlaybookConteudoPreview("");
    setPlaybookConteudoAnalise("");
    setPlaybookUploadStatus("idle");
    setPlaybookUploadMensagem("");
    setPlaybookUploadPct(0);
    setPlaybookAnaliseErro("");
    setPlaybookAnaliseResultado(null);
  }

  async function analisarPlaybookComMistral() {
    if (!playbookConteudoAnalise.trim()) {
      setPlaybookAnaliseErro("Carregue um playbook antes de solicitar análise.");
      return;
    }

    playbookAnaliseAbortRef.current?.abort();
    const abort = new AbortController();
    playbookAnaliseAbortRef.current = abort;

    setPlaybookAnaliseLoading(true);
    setPlaybookAnaliseErro("");
    setPlaybookAnaliseResultado(null);
    setPlaybookAnalisePct(6);

    pararProgressoAnalisePlaybook();
    playbookAnaliseTickRef.current = window.setInterval(() => {
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

      const fetchOpts = {
        method: "POST" as const,
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      };

      let res: Response;
      if (agenteSlugCriado) {
        res = await fetch(
          `/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/playbook/analisar`,
          fetchOpts
        );
      } else {
        res = await fetch(`/api/hub/playbook/analisar-conteudo`, fetchOpts);
      }

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        setPlaybookAnaliseResultado(normalizarAnalisePlaybook(data));
        analiseOk = true;
        return;
      }

      if (res.status === 503 && !agenteSlugCriado) {
        setPlaybookAnaliseErro("Serviço de IA indisponível para análise com nota. Contacte o suporte da plataforma.");
        return;
      }

      // Fallback final apenas com agente já criado.
      if (agenteSlugCriado && (res.status === 404 || res.status === 405 || res.status >= 500)) {
        const syncRes = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlugCriado)}/mistral-sync`, {
          method: "POST",
          headers: await crmApiHeaders(),
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
            "Análise textual local concluída. Endpoint de análise Mistral ainda indisponível neste ambiente.",
          nota: null,
          notaComentario: "",
          pontosChave: linhas,
          gaps: [],
          riscos: ["Valide no backend o endpoint POST /playbook/analisar."],
          recomendacoes: ["Tente novamente quando o serviço de IA estiver disponível."],
          textoBruto: detalhes,
          modelo: null,
          origem: "fallback",
        });
        analiseOk = true;
        return;
      }

      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setPlaybookAnaliseErro(err.error || `Falha na análise (HTTP ${res.status}).`);
    } catch (e) {
      if (abort.signal.aborted) return;
      setPlaybookAnaliseErro("Falha de rede ao analisar o playbook.");
    } finally {
      if (abort.signal.aborted) {
        pararProgressoAnalisePlaybook();
        playbookAnaliseAbortRef.current = null;
        return;
      }
      pararProgressoAnalisePlaybook();
      playbookAnaliseAbortRef.current = null;
      if (analiseOk) {
        setPlaybookAnalisePct(100);
        await new Promise((r) => setTimeout(r, 420));
      }
      setPlaybookAnaliseLoading(false);
      setPlaybookAnalisePct(0);
    }
  }

  function aplicarPresetWaNoWizard() {
    setSomentePlaybook(false);
    setUsarPresetWa(true);
    setModoOperacao("canal_whatsapp");
    setModoExecucao("interacao");
    setMotorFerramentasHub(true);
    setUsoFerramentasIa(mergeUsoFerramentasWhatsappCanal({}, "canal_whatsapp"));
    const cargoPreset = cargos.find((c) => c.slug === WA_PRESET_CARGO_SLUG);
    if (cargoPreset) setCargoSelecionado(cargoPreset);
    setConhecimentoSecoes((prev) => ({
      ...prev,
      atendimento:
        prev.atendimento.trim() ||
        "- Uma pergunta por mensagem; máx. 2–3 linhas.\n- Seja proativo: sempre indique o próximo passo.\n- Use a base de conhecimento — não invente preços ou prazos.",
      proibicoes:
        prev.proibicoes.trim() ||
        "- Não inventar preços, prazos ou condições fora da documentação.\n- Não prometer o que não está na base de conhecimento.",
    }));
    void aplicarTemplateWajeV1NoWizard();
    setPlaybookUploadMensagem(
      "Preset conversação WA aplicado: cargo, playbook v1, ferramentas e ciclos serão provisionados ao criar."
    );
  }

  async function aplicarTemplateWajeV1NoWizard() {
    if (playbookUploadStatus === "enviando" || playbookAnaliseLoading) return;
    setPlaybookErro("");
    try {
      const res = await fetch(PLAYBOOK_EXEMPLO_MD_URL, { headers: await crmApiHeaders() });
      if (!res.ok) {
        setPlaybookErro(`Falha ao carregar template Waje v1 (HTTP ${res.status}).`);
        return;
      }
      const texto = (await res.text()).trim();
      if (!texto) {
        setPlaybookErro("Template Waje v1 vazio.");
        return;
      }
      setPlaybookArquivoNome(PLAYBOOK_EXEMPLO_ARQUIVO);
      setPlaybookConteudoPreview(texto.slice(0, 2500));
      setPlaybookConteudoAnalise(texto);
      setPlaybookArquivoPendente(null);
      setPlaybookUploadStatus("sucesso");
      setPlaybookUploadPct(100);
      setPlaybookUploadMensagem(
        somentePlaybook
          ? "Template Waje v1 aplicado. Ajuste o conteúdo e analise o playbook."
          : "Template Waje v1 aplicado. Ajuste o conteúdo ou avance com o cargo."
      );
      setPlaybookAnaliseErro("");
      setPlaybookAnaliseResultado(null);
    } catch {
      setPlaybookErro("Falha de rede ao carregar template Waje v1.");
    }
  }

  async function publicarPlaybookPendenteAposCriar(
    slug: string
  ): Promise<{ ok: boolean; path?: string; error?: string }> {
    if (playbookArquivoPendente) {
      return salvarPlaybookPorUpload(playbookArquivoPendente, slug);
    }
    const texto = playbookConteudoAnalise.trim();
    if (!texto) return { ok: true };
    const nomeArq = playbookArquivoNome.trim() || PLAYBOOK_EXEMPLO_ARQUIVO;
    const file = new File([texto], nomeArq, { type: "text/markdown;charset=utf-8" });
    return salvarPlaybookPorUpload(file, slug);
  }

  function limparEstadoWizardNaUrl() {
    clearWizardOAuthResume();
    router.replace(
      pathnameWithStrippedWizardParams(pathname, new URLSearchParams(searchParams.toString())),
      { scroll: false }
    );
  }

  function concluirPosCriacao() {
    limparEstadoWizardNaUrl();
    if (variant === "drawer" && onClose) onClose();
    else router.push("/crm/agentes");
  }

  const wizardDark = variant === "drawer";
  const precisaPassoCanal = agenteEhModoCanal(modoOperacao);
  const recomendaGoogleWorkspace = cargoRecomendaGoogleWorkspace({
    cargoTitulo: cargoSelecionado?.titulo,
    cargoDescricao: cargoSelecionado?.descricao_curta ?? cargoSelecionado?.descricao,
    cargoSlug: cargoSelecionado?.slug,
    cargoEspecialidade: cargoSelecionado?.especialidade,
    nomeAgente: nome,
  });
  const precisaGoogleWorkspace = agentePrecisaGoogleWorkspace(usoFerramentasIa, {
    recomendaCargo: recomendaGoogleWorkspace,
    modoCanal: precisaPassoCanal,
  });
  const googleNoPassoCanal = precisaPassoCanal && precisaGoogleWorkspace;
  const precisaPassoGoogle = precisaGoogleWorkspace && !precisaPassoCanal && !wizardInterno;
  const wizardPassosVisiveis = useMemo(() => {
    const items: { id: number; label: string }[] = [{ id: 0, label: "Tipo" }];
    if (wizardInterno) {
      items.push(
        { id: 1, label: "Cargo" },
        { id: 2, label: "Identidade" },
        { id: 6, label: "Ferramentas" },
        { id: 8, label: "Harness" },
        { id: 5, label: "Revisão" },
        { id: 7, label: "Integrações" }
      );
      return items;
    }
    for (let i = 0; i < 7; i += 1) {
      items.push({ id: i + 1, label: WIZARD_STEP_LABELS[i] });
    }
    if (precisaPassoCanal) {
      items.push({
        id: 8,
        label: googleNoPassoCanal ? "Canal + Agenda" : "Canal",
      });
    }
    if (precisaPassoGoogle) items.push({ id: 9, label: "Agenda Google" });
    return items;
  }, [wizardInterno, precisaPassoCanal, precisaPassoGoogle, googleNoPassoCanal]);

  const integradorCatalogWizard = useMemo(
    () => buildCatalogoIntegradorFerramentasCompleto(integradorConexoesWizard),
    [integradorConexoesWizard]
  );

  const playbookDropzoneBorder =
    playbookUploadStatus === "hover"
      ? `1px dashed ${wizardDark ? "#92ff00" : "#2d6a4f"}`
      : playbookUploadStatus === "erro"
        ? "1px dashed #f85149"
        : playbookUploadStatus === "sucesso"
          ? "1px dashed #3fb950"
          : wizardDark
            ? "1px dashed rgba(63, 152, 72, 0.42)"
            : "1px dashed #3d444d";

  const playbookDropzoneBg =
    playbookUploadStatus === "hover"
      ? wizardDark
        ? "rgba(146, 255, 0, 0.08)"
        : "#2d6a4f14"
      : playbookUploadStatus === "erro"
        ? "#f8514912"
        : playbookUploadStatus === "sucesso"
          ? wizardDark
            ? "rgba(63, 185, 80, 0.12)"
            : "#23863618"
          : wizardDark
            ? "rgba(6, 13, 8, 0.72)"
            : "#f8fcf6";

  const playbookPanelTheme = wizardDark ? ("dark" as const) : ("light" as const);

  const passo1AvancarBloqueado = somentePlaybook
    ? !playbookConteudoAnalise.trim() ||
      !playbookAnaliseResultado ||
      (whatsappFlowAgent && !playbookFlowReady(playbookFlowStatus))
    : wizardInterno
      ? !cargoSelecionado
      : !cargoSelecionado;

  useEffect(() => {
    if (passo !== 6) {
      hubCiclosLoadRef.current = false;
      return;
    }
    if (hubCiclosLoadRef.current) return;
    hubCiclosLoadRef.current = true;
    setHubCiclosCarregando(true);
    void crmApiHeaders()
      .then((headers) => fetch("/api/hub/ciclos", { headers }))
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
    void crmApiHeaders()
      .then((headers) => fetch("/api/hub/cargos", { headers }))
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

  const gerarHarnessInterno = useCallback(async (cargo: Cargo) => {
    const reqId = ++harnessReqRef.current;
    setHarnessGerando(true);
    setHarnessErro("");
    setHarnessPromptGerado("");
    setHarnessSkills([]);
    setHarnessGeradoComIa(false);
    try {
      const usoAtivo = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa);
      const res = await fetch("/api/hub/agentes/gerar-harness-interno", {
        method: "POST",
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ cargo_slug: cargo.slug, uso_ferramentas_ia: usoAtivo }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        harness?: {
          system_prompt_base?: string;
          skills?: SuperagenteSkill[];
          gerado_com_ia?: boolean;
        };
      };
      if (reqId !== harnessReqRef.current) return;
      if (!res.ok) {
        setHarnessErro(data.error || `Falha ao gerar harness (HTTP ${res.status}).`);
        return;
      }
      const prompt = String(data.harness?.system_prompt_base ?? "").trim();
      if (!prompt) {
        setHarnessErro("Resposta sem prompt base.");
        return;
      }
      setHarnessPromptGerado(prompt);
      setHarnessSkills(Array.isArray(data.harness?.skills) ? data.harness!.skills! : []);
      setHarnessGeradoComIa(data.harness?.gerado_com_ia === true);
      setHarnessAprovado(false);
    } catch {
      if (reqId === harnessReqRef.current) {
        setHarnessErro("Falha de rede ao gerar prompt e skills.");
      }
    } finally {
      if (reqId === harnessReqRef.current) setHarnessGerando(false);
    }
  }, [usoFerramentasIa]);

  useEffect(() => {
    if (!wizardInterno || !cargoSelecionado) {
      harnessReqRef.current += 1;
      setHarnessPromptGerado("");
      setHarnessSkills([]);
      setHarnessGerando(false);
      setHarnessErro("");
      setHarnessGeradoComIa(false);
      setHarnessAprovado(false);
      harnessPasso6LoadRef.current = false;
      return;
    }
  }, [wizardInterno, cargoSelecionado?.slug]);

  useEffect(() => {
    if (passo !== 6 && passo !== 8) {
      harnessPasso6LoadRef.current = false;
      return;
    }
    if (!wizardInterno || !cargoSelecionado) return;
    if (harnessPasso6LoadRef.current) return;
    harnessPasso6LoadRef.current = true;
    void gerarHarnessInterno(cargoSelecionado);
  }, [passo, wizardInterno, cargoSelecionado, gerarHarnessInterno]);

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

  function selecionarModoOperacao(id: ModoOperacaoAgente) {
    if (id === "canal_email" && !isEmailChannelEnabledClient()) return;
    setModoOperacao(id);
    if (agenteEhModoCanal(id)) setModoExecucao("interacao");
    else if (modoExecucao === "interacao") setModoExecucao("agenda");
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
    limparEstadoWizardNaUrl();
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
    const cicloExecucaoPadrao = agenteEhModoCanal(modoOperacao) ? "interacao" : modoExecucao;
    const syncRes = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        prefixo_mercado: prefixoMercadoParaGravacao([]),
        personalidade: gerarPersonalidadeAgente(valores),
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
          "Não foi possível gravar a configuração do agente. Tente de novo ou abra a ficha do agente."
      );
      return false;
    }
    return true;
  }

  function conhecimentoSecoesParaPayload(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of WIZARD_CONHECIMENTO_SECOES) {
      const val = conhecimentoSecoes[key].trim();
      if (val) out[key] = val;
    }
    return out;
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
        prefixo_mercado: prefixoMercadoParaGravacao([]),
        personalidade: gerarPersonalidadeAgente(valores),
        system_prompt_base: wizardInterno && harnessPromptGerado.trim() ? harnessPromptGerado.trim() : "",
        harness_skills: wizardInterno && harnessSkills.length > 0 ? harnessSkills : undefined,
        conhecimento_secoes: wizardInterno ? {} : conhecimentoSecoesParaPayload(),
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
        payload.ciclo_execucao = agenteEhModoCanal(modoOperacao) ? "interacao" : modoExecucao;
        if (modoExecucao === "agenda" && !agenteEhModoCanal(modoOperacao)) {
          payload.ciclo_intervalo_minutos = agendaModo === "intervalo" ? agendaIntervalMin : undefined;
          if (agendaModo === "horario_fixo") payload.ciclo_hora_local_br = agendaHoraLocal;
        }
      } else {
        payload.modo_operacao = modoOperacao;
        payload.ciclo_execucao = agenteEhModoCanal(modoOperacao) ? "interacao" : modoExecucao;
        if (
          modoOperacao === "jobs_internos" &&
          modoExecucao === "interacao" &&
          hubCicloEstrategia === "provisionar"
        ) {
          payload.omit_hub_ciclo_padrao = true;
        }
        payload.ciclo_intervalo_minutos =
          modoExecucao === "agenda" && agendaModo === "intervalo" ? agendaIntervalMin : undefined;
        if (modoExecucao === "agenda" && agendaModo === "horario_fixo") {
          payload.ciclo_hora_local_br = agendaHoraLocal;
        }
        if (hubCiclosVincularIds.length > 0) {
          payload.ciclos_vincular_ids = hubCiclosVincularIds;
        }
      }
      if (usarPresetWa && modoOperacao === "canal_whatsapp") {
        payload.wa_preset = "conversacao_universal";
        if (!payload.cargo_slug) payload.cargo_slug = WA_PRESET_CARGO_SLUG;
      }
      const res = await fetch("/api/hub/agentes", {
        method: "POST",
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
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
          console.error("[CRM] Agent criado mas ciclo padrão falhou:", data.ciclo_erro);
          setErro(
            `Agente criado, mas o ciclo padrão não foi gravado: ${data.ciclo_erro}. Abra a ficha do agente ou crie um ciclo em Ciclos IA.`
          );
        } else if (data.ciclo_aviso) {
          console.warn("[CRM]", data.ciclo_aviso);
        }

        if (slug) {
          if (!wizardInterno) {
            const temPlaybookPendente = Boolean(playbookArquivoPendente || playbookConteudoAnalise.trim());
            if (temPlaybookPendente && (somentePlaybook || cargoSelecionado)) {
              const pub = await publicarPlaybookPendenteAposCriar(slug);
              if (!pub.ok) {
                setRagPosCriacaoAviso(
                  `Agente criado, mas o playbook não foi gravado na pasta do agente: ${pub.error ?? "erro desconhecido"}. ` +
                    "Reenvie no passo Materiais."
                );
              }
            }
            await processarFilaRagNoAgente(slug);
          }
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
        } else setErro("Agente criado mas a API não devolveu o slug.");
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

  const personalidadeGerada = gerarPersonalidadeAgente(valores);

  const {
    wzTitulo,
    wzH2,
    wzP,
    wzStrong,
    wzMuted,
    wzDivider,
    wzCard,
    wzPanelWrap,
    wzInput,
    wzTextarea,
    wzLabel,
    wzSectionLabel: wizardSectionLabel,
    chip,
    cargoCard,
    wizardBtnPrimary,
    wizardBtnSecondary,
    wizardChoiceCard,
    wizardChoicePill,
    wizardInfoBox,
    wizardOutline,
    stepCircle,
    stepLabel,
    stepConnector,
  } = createAgenteWizardTheme(wizardDark);

  const rootStyle: CSSProperties =
    variant === "page"
      ? { minHeight: "100vh", background: "#f8fcf6", display: "flex", flexDirection: "column" }
      : {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          background: "#060d08",
          flex: 1,
        };

  return (
    <div style={rootStyle}>
      <CrmConfirmDialog
        open={showConfirm}
        title="Confirmar criação"
        theme={wizardDark ? "dark" : "light"}
        confirmLabel="Confirmar"
        loading={criando}
        loadingLabel="Criando…"
        onCancel={() => !criando && setShowConfirm(false)}
        onConfirm={() => void criarAgente({ avancarPasso: true })}
      >
        <p style={{ margin: "0 0 10px", color: wizardDark ? RF.texto2 : undefined }}>
          Confirmar criação do agente <strong style={{ color: wizardDark ? RF.limao : "#0b1f10" }}>{nome}</strong> no Hub Waje?
        </p>
        <p style={{ margin: "0 0 10px", color: wizardDark ? RF.texto2 : undefined }}>
          Instrução:{" "}
          <strong style={{ color: wizardDark ? RF.limao : "#0b1f10" }}>
            {modoInstrucaoWizardResumo({
              somentePlaybook,
              temPlaybookCarregado: Boolean(playbookConteudoAnalise.trim()),
              temCargo: Boolean(cargoSelecionado),
            })}
          </strong>
          . Tipo: <strong style={{ color: wizardDark ? RF.limao : "#0b1f10" }}>{modoOperacaoWizardResumo(modoOperacao)}</strong>.
        </p>
        <p style={{ margin: 0, color: wizardDark ? RF.texto2 : undefined }}>
          {precisaPassoCanal
            ? "Depois: Materiais (playbook) e Canal (WhatsApp)."
            : "Depois: Integrações (Google, Mistral e catálogo). Sem playbook nem canal."}
        </p>
        {erro ? <p style={{ color: "#ef4444", fontSize: 12, margin: "12px 0 0" }}>{erro}</p> : null}
      </CrmConfirmDialog>

      <div
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: wizardDark ? "#060d08" : "#ffffff",
          borderBottom: `1px solid ${wizardDark ? "rgba(63, 152, 72, 0.42)" : "#dcebd8"}`,
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
                color: wizardDark ? "#92ff00" : "#5d7a67",
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >←</button>
          </div>
          {tipoWizard || (nome.trim() && (cargoSelecionado || somentePlaybook)) ? (
            <p style={{ color: wizardDark ? "#7a9a7e" : "#5d7a67", fontSize: 12, margin: 0 }}>
              {tipoWizard ? WIZARD_TIPO_LABEL[tipoWizard] : null}
              {tipoWizard && nome.trim() && (cargoSelecionado || somentePlaybook) ? " · " : null}
              {nome.trim() && (cargoSelecionado || somentePlaybook)
                ? `${nome} · ${cargoSelecionado?.titulo ?? CARGO_LABEL_PLAYBOOK_ONLY}`
                : null}
            </p>
          ) : null}
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
          {wizardPassosVisiveis.map((item, i) => {
            const num = item.id;
            const ativo = passo === num;
            const passado = passo > num;
            return (
              <div key={item.label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 56 }}>
                <div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}
                >
                  <div style={stepCircle(ativo, passado)}>{passado ? "✓" : num === 0 ? "•" : num}</div>
                  <span
                    style={{
                      ...stepLabel(ativo),
                      whiteSpace: "nowrap",
                      maxWidth: 72,
                      lineHeight: 1.15,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                {i < wizardPassosVisiveis.length - 1 && (
                  <div
                    style={{
                      ...stepConnector(passo > num),
                      flex: 0,
                      width: 12,
                      flexShrink: 0,
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
            maxWidth: passo === 6 || (passo === 8 && precisaPassoCanal) || passo === 9 ? 1180 : 760,
            margin: "0 auto",
            padding: "28px 24px 48px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {passo === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_PASSO_0.titulo}</h2>
                <p style={wzP}>{AGENTE_WIZARD_PASSO_0.descricao}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(
                  [
                    {
                      id: "canal" as const,
                      Icon: MessageSquare,
                      titulo: WIZARD_TIPO_LABEL.canal,
                      texto:
                        "Atende clientes e leads no WhatsApp (ou e-mail). Cargo do catálogo + playbook de fluxo. Liga instância UAZAPI no final.",
                    },
                    {
                      id: "interno" as const,
                      Icon: Zap,
                      titulo: WIZARD_TIPO_LABEL.interno,
                      texto:
                        "Copiloto e superagente da empresa: CRM, relatórios com gráficos, Mistral OCR. Cargo do catálogo como base do harness. Disponível no WhatsApp do gestor.",
                    },
                  ] as const
                ).map((opt) => {
                  const Ico = opt.Icon;
                  const ativo = tipoWizard === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => aplicarTipoWizard(opt.id)}
                      style={wizardChoiceCard(ativo)}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left" }}>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: ativo
                              ? wizardDark
                                ? "rgba(146, 255, 0, 0.14)"
                                : "rgba(56,139,253,0.12)"
                              : wizardDark
                                ? "rgba(11, 31, 16, 0.9)"
                                : "#eef7eb",
                            flexShrink: 0,
                          }}
                        >
                          <Ico size={18} color={ativo ? (wizardDark ? "#92ff00" : "#2d6a4f") : wzMuted} />
                        </span>
                        <div>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: wzStrong }}>{opt.titulo}</p>
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: wzMuted, lineHeight: 1.5 }}>
                            {opt.texto}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {passo === 1 && tipoWizard && (
            <div>
              <h2 style={{ ...wzH2, margin: "0 0 4px" }}>{AGENTE_WIZARD_STEP_INTRO[1].titulo}</h2>
              <p style={{ ...wzP, margin: "0 0 16px" }}>
                {AGENTE_WIZARD_STEP_INTRO[1].descricao}
              </p>

              {wizardInterno ? (
                <div style={{ ...wizardInfoBox(), marginBottom: 16 }}>
                  <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Assistente interno:</strong> o cargo
                  do catálogo define persona, modelo e harness (skills). As ferramentas de superagente (CRM,
                  relatórios, OCR Mistral) já vêm pré-activadas no passo Ferramentas.
                </div>
              ) : null}

              {wizardCanal ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${wizardDark ? "rgba(146, 255, 0, 0.28)" : "#2d6a4f44"}`,
                    background: wizardDark ? "rgba(146, 255, 0, 0.06)" : "#2d6a4f0c",
                  }}
                >
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: wzMuted, lineHeight: 1.5 }}>
                    <strong style={{ color: wzStrong }}>Preset conversação WhatsApp</strong> — playbook com fluxo
                    dinâmico, cargo de atendimento, ferramentas CRM, ciclo sob interação e follow-up proativo.
                  </p>
                  <button
                    type="button"
                    onClick={aplicarPresetWaNoWizard}
                    disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading || criando}
                    style={wizardOutline(playbookUploadStatus === "enviando" || playbookAnaliseLoading || criando)}
                  >
                    {usarPresetWa ? "✓ Preset WA activo" : "Aplicar preset conversação WA"}
                  </button>
                </div>
              ) : null}

              {!wizardInterno ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSomentePlaybook(false);
                      setUsarPresetWa(false);
                    }}
                    style={chip(!somentePlaybook && !usarPresetWa)}
                  >
                    Cargo do catálogo (recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSomentePlaybook(true);
                      setCargoSelecionado(null);
                    }}
                    style={chip(somentePlaybook, "#c9a24a")}
                  >
                    Só playbook (sem cargo)
                  </button>
                </div>
              ) : null}

              {!wizardInterno && somentePlaybook ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => void aplicarTemplateWajeV1NoWizard()}
                      disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading}
                      style={wizardOutline(
                        playbookUploadStatus === "enviando" || playbookAnaliseLoading
                      )}
                    >
                      Aplicar template Waje v1
                    </button>
                  </div>
                  <PlaybookUploadAnalisePanel
                    inputId={PLAYBOOK_INPUT_PRE}
                    modoPreCriacao
                    analiseObrigatoria
                    theme={playbookPanelTheme}
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
                    progressoContexto={playbookArquivoNome || undefined}
                    onHoverChange={(hover) => {
                      if (playbookUploadStatus !== "enviando") {
                        setPlaybookUploadStatus(hover ? "hover" : "idle");
                      }
                    }}
                    onFileSelect={(file) => void carregarPlaybookLocal(file)}
                    onAnalisar={() => void analisarPlaybookComMistral()}
                    onCancelarAnalise={cancelarAnalisePlaybook}
                    onLimparArquivo={limparPlaybookCarregado}
                  />
                </div>
              ) : null}
              {!wizardInterno && somentePlaybook && playbookConteudoAnalise.trim() && whatsappFlowAgent ? (
                <PlaybookFlowStatusBanner status={playbookFlowStatus} compact />
              ) : null}

              {!somentePlaybook && carregando ? (
                <p style={{ color: wzMuted, fontSize: 13 }}>Carregando cargos...</p>
              ) : !somentePlaybook && erroCargos ? (
                <div>
                  <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 10px" }}>Erro ao carregar cargos.</p>
                  <button
                    type="button"
                    onClick={carregarCargos}
                    style={wizardOutline(false)}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : !somentePlaybook ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <p style={wizardSectionLabel}>SEGMENTO</p>
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
                      <p style={wizardSectionLabel}>ESPECIALIDADE</p>
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
                    <p style={{ color: wzMuted, fontSize: 13 }}>Nenhum cargo encontrado.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cargosFiltrados.map((c) => {
                        const ativo = cargoSelecionado?.slug === c.slug;
                        const segCor = SEGMENTO_COR[c.segmento || ""] || "#5d7a67";
                        const nivelCor = NIVEL_COR[c.nivel || ""] || "#5d7a67";
                        return (
                          <button
                            type="button"
                            key={c.slug}
                            onClick={() => setCargoSelecionado(c)}
                            style={cargoCard(ativo)}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ color: wzTitulo, fontSize: 14, fontWeight: 700 }}>{c.titulo}</span>
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
                                  <span style={{ fontSize: 10, color: wizardDark ? RF.texto3 : "#5d7a67" }}>
                                    {c.especialidade}
                                  </span>
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
                                <p style={{ color: wizardDark ? RF.texto3 : "#5d7a67", fontSize: 12, margin: 0 }}>
                                  {c.descricao_curta}
                                </p>
                              )}
                            </div>
                            {ativo && <span style={{ color: "#92ff00", fontSize: 16, flexShrink: 0 }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {cargoSelecionado ? (
                    <div
                      style={{
                        marginTop: 24,
                        paddingTop: 20,
                        borderTop: `1px solid ${wzDivider}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {wizardInterno ? (
                        <div style={{ ...wizardInfoBox(), marginTop: 4 }}>
                          <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Harness:</strong>{" "}
                          no passo <strong style={{ color: wzStrong }}>Ferramentas</strong>, depois de activar o
                          pacote superagente, o sistema gera a <strong style={{ color: wzStrong }}>identidade</strong>{" "}
                          (prompt base) e as <strong style={{ color: wzStrong }}>skills</strong>. O motor completo
                          (ferramentas CRM, orquestração, memória) é injectado em runtime — não fica só neste texto.
                        </div>
                      ) : (
                        <>
                          <div>
                            <p style={{ color: wzStrong, fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>
                              Playbook opcional
                            </p>
                            <p style={{ color: wzMuted, fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                              Combine cargo + playbook: o cargo orienta a conversa e o playbook publica o fluxo no
                              Storage. Pode carregar agora ou no passo{" "}
                              <strong style={{ color: wzStrong }}>Materiais</strong>.
                            </p>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => void aplicarTemplateWajeV1NoWizard()}
                              disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading}
                              style={wizardOutline(
                                playbookUploadStatus === "enviando" || playbookAnaliseLoading
                              )}
                            >
                              Aplicar template Waje v1
                            </button>
                          </div>
                          <PlaybookUploadAnalisePanel
                            inputId={`${PLAYBOOK_INPUT_PRE}-cargo`}
                            modoPreCriacao
                            analiseObrigatoria={false}
                            theme={playbookPanelTheme}
                            introPreCriacao="Opcional: carregue um playbook para publicar junto com o cargo ao criar o agente. A análise de qualidade é recomendada, mas não bloqueia o avanço."
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
                            progressoContexto={playbookArquivoNome || cargoSelecionado?.titulo}
                            onHoverChange={(hover) => {
                              if (playbookUploadStatus !== "enviando") {
                                setPlaybookUploadStatus(hover ? "hover" : "idle");
                              }
                            }}
                            onFileSelect={(file) => void carregarPlaybookLocal(file)}
                            onAnalisar={() => void analisarPlaybookComMistral()}
                            onCancelarAnalise={cancelarAnalisePlaybook}
                            onLimparArquivo={limparPlaybookCarregado}
                          />
                          {playbookConteudoAnalise.trim() && whatsappFlowAgent ? (
                            <PlaybookFlowStatusBanner status={playbookFlowStatus} compact />
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )}

          {passo === 2 && (cargoSelecionado || somentePlaybook) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[2].titulo}</h2>
                <p style={wzP}>
                  {AGENTE_WIZARD_STEP_INTRO[2].descricao}
                  {wizardInterno
                    ? " No passo Ferramentas activa os toolsets; no Harness revê skills e identidade antes de publicar."
                    : somentePlaybook
                      ? " Comportamento operacional: playbook no Storage."
                      : playbookConteudoAnalise.trim()
                        ? " Playbook carregado no passo Cargo será publicado ao criar o agente."
                        : ""}
                </p>
              </div>

              {!somentePlaybook && cargoSelecionado ? (
              <div style={{ ...wzCard(), padding: 16 }}>
                <p style={{ color: wizardDark ? "#e3b341" : "#c9a24a", fontSize: 11, fontWeight: 700, margin: "0 0 12px" }}>
                  Fixo do cargo 🔒
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: wzMuted, display: "block", marginBottom: 4 }}>
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
                          background: (NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67") + "22",
                          color: NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67",
                          border: `1px solid ${(NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67")}44`,
                        }}
                      >
                        {cargoSelecionado.nivel}
                      </span>
                    ) : (
                      <span style={{ color: wzMuted, fontSize: 13 }}>—</span>
                    )}
                  </div>
                </div>
              </div>
              ) : null}

              <div>
                <label style={wzLabel}>
                  Nome do agente <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Ana, Lucas, Assistente Comercial..."
                  style={wzInput}
                />
              </div>

              <div>
                <label style={{ ...wzLabel, marginBottom: 6 }}>Tipo de agente</label>
                {tipoWizard ? (
                  <div style={{ ...wzCard(), padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: wizardDark ? "rgba(146, 255, 0, 0.14)" : "rgba(56,139,253,0.12)",
                          color: wizardDark ? "#92ff00" : "#2d6a4f",
                          border: `1px solid ${wizardDark ? "rgba(146, 255, 0, 0.35)" : "#2d6a4f44"}`,
                        }}
                      >
                        {WIZARD_TIPO_LABEL[tipoWizard]}
                      </span>
                      <span style={{ color: wzMuted, fontSize: 12 }}>
                        {modoOperacaoWizardResumo(modoOperacao)}
                      </span>
                    </div>
                    {wizardInterno ? (
                      <p style={{ margin: 0, fontSize: 12, color: wzMuted, lineHeight: 1.5 }}>
                        Sem instância UAZAPI por agente — o assistente fica disponível no{" "}
                        <strong style={{ color: wzStrong }}>WhatsApp do gestor</strong> (hub central).
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
                      Atendimento fala com clientes no WhatsApp
                      {isEmailChannelEnabledClient() ? " ou e-mail" : ""}. Interno executa tarefas e ciclos no
                      escritório, sem fila ao vivo.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(
                        [
                          {
                            id: "canal_whatsapp" as const,
                            Icon: MessageSquare,
                            titulo: MODO_OPERACAO_LABEL.canal_whatsapp,
                            texto: MODO_OPERACAO_DESCRICAO.canal_whatsapp,
                            badge: null,
                          },
                          ...(isEmailChannelEnabledClient()
                            ? [
                                {
                                  id: "canal_email" as const,
                                  Icon: Mail,
                                  titulo: MODO_OPERACAO_LABEL.canal_email,
                                  texto: MODO_OPERACAO_DESCRICAO.canal_email,
                                  badge: null,
                                },
                              ]
                            : []),
                          {
                            id: "jobs_internos" as const,
                            Icon: Zap,
                            titulo: MODO_OPERACAO_LABEL.jobs_internos,
                            texto: MODO_OPERACAO_DESCRICAO.jobs_internos,
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
                            onClick={() => selecionarModoOperacao(opt.id)}
                            style={wizardChoiceCard(ativo)}
                          >
                            <Ico
                              size={20}
                              color={ativo ? (wizardDark ? RF.limao : CRM_ACCENT) : wzMuted}
                              strokeWidth={2}
                              aria-hidden
                            />
                            <span style={{ minWidth: 0 }}>
                              <span
                                style={{
                                  display: "block",
                                  color: wzStrong,
                                  fontWeight: 700,
                                  fontSize: 13,
                                  marginBottom: 4,
                                }}
                              >
                                {opt.titulo}
                              </span>
                              <span style={{ color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>{opt.texto}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {passo === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[3].titulo}</h2>
                <p style={wzP}>{AGENTE_WIZARD_STEP_INTRO[3].descricao}</p>
              </div>

              <AgentePersonalidadeEixosPanel
                valores={valores}
                onChange={setValor}
                theme={wizardDark ? "dark" : "light"}
              />
            </div>
          )}

          {passo === 4 && !wizardInterno && (
            <div style={wzPanelWrap()}>
              <div>
                <h2 style={{ ...wzH2, margin: "0 0 6px" }}>{AGENTE_WIZARD_STEP_INTRO[4].titulo}</h2>
                <p style={wzP}>{AGENTE_WIZARD_STEP_INTRO[4].descricao}</p>
              </div>

              <div
                style={{
                  ...wzCard({ padding: 16 }),
                  borderLeft: `3px solid ${wizardDark ? RF.limao : "#c9a24a"}`,
                }}
              >
                <h3 style={{ color: wzStrong, fontSize: 14, fontWeight: 800, margin: "0 0 6px" }}>
                  1. Conhecimento estruturado (playbook)
                </h3>
                <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 14px", lineHeight: 1.55 }}>
                  Texto curto por seção — compõe o playbook ao criar o agente. O cargo já traz saudação e fluxo base.
                </p>

              {cargoSelecionado ? (
                <div
                  style={{
                    ...wzCard({ padding: 14 }),
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <p style={{ margin: 0, color: wizardDark ? RF.limao : wzMuted, fontSize: 11, fontWeight: 700 }}>
                    PREVIEW DO CARGO (ATENDIMENTO)
                  </p>
                  {typeof cargoSelecionado.saudação_cliente === "string" && cargoSelecionado.saudação_cliente.trim() ? (
                    <p style={{ margin: 0, color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                      <strong style={{ color: wzStrong }}>Saudação:</strong>{" "}
                      {cargoSelecionado.saudação_cliente.trim()}
                    </p>
                  ) : (
                    <p style={{ margin: 0, color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                      Sem saudação padrão definida no cargo.
                    </p>
                  )}
                  {typeof cargoSelecionado.comprimento_padrao === "string" && cargoSelecionado.comprimento_padrao.trim() ? (
                    <p style={{ margin: 0, color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                      <strong style={{ color: wzStrong }}>Comprimento:</strong>{" "}
                      {cargoSelecionado.comprimento_padrao.trim()}
                    </p>
                  ) : null}
                  {cargoSelecionado.usar_perguntas_essenciais === true ? (
                    <div>
                      <p style={{ margin: "0 0 4px", color: wzStrong, fontSize: 12, fontWeight: 700 }}>
                        Perguntas essenciais
                      </p>
                      {splitLinesLite(cargoSelecionado.perguntas_essenciais).length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: 18, color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                          {splitLinesLite(cargoSelecionado.perguntas_essenciais).slice(0, 5).map((pergunta, idx) => (
                            <li key={`${pergunta}-${idx}`}>{pergunta}</li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ margin: 0, color: wzMuted, fontSize: 12 }}>
                          Ativado no cargo, mas sem perguntas cadastradas.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: wzMuted, fontSize: 12 }}>
                      Este cargo não exige sequência de perguntas essenciais.
                    </p>
                  )}
                </div>
              ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {WIZARD_CONHECIMENTO_SECOES.map((secaoId) => (
                    <div key={secaoId}>
                      <label style={{ ...wzLabel, marginBottom: 6 }}>
                        {CONHECIMENTO_TITULO_INSERT[secaoId]}
                        <span style={{ color: wzMuted, fontWeight: 500, fontSize: 11 }}> (opcional)</span>
                      </label>
                      <textarea
                        value={conhecimentoSecoes[secaoId]}
                        onChange={(e) =>
                          setConhecimentoSecoes((prev) => ({ ...prev, [secaoId]: e.target.value }))
                        }
                        placeholder={WIZARD_CONHECIMENTO_PLACEHOLDERS[secaoId]}
                        rows={secaoId === "proibicoes" ? 3 : 4}
                        style={wzTextarea}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  ...wzCard({ padding: 16 }),
                  borderLeft: `3px solid ${wizardDark ? RF.texto : "#0b1f10"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h3 style={{ color: wzStrong, fontSize: 14, fontWeight: 800, margin: "0 0 6px" }}>
                      2. Documentos deste assistente (consulta na conversa)
                    </h3>
                    <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.55 }}>
                      Opcional — só para material <strong style={{ color: wzStrong }}>específico desta função</strong>{" "}
                      (scripts, POPs exclusivos, checklists). Catálogo, políticas e informação geral da empresa ficam em{" "}
                      <strong style={{ color: wzStrong }}>CRM → Conhecimento</strong> e são consultados por{" "}
                      <strong style={{ color: wzStrong }}>todos os agentes</strong> na conversa. Até{" "}
                      <strong style={{ color: wzStrong }}>{RAG_DOCS_LIMIT} ficheiros</strong> nesta fila — são
                      preparados ao criar o agente ou ao clicar em «Preparar documentos agora». Formatos:{" "}
                      <strong style={{ color: wzStrong }}>{RAG_FORMATOS_RESUMO}</strong>.
                    </p>
                  </div>
                  <span
                    style={{
                      color: ragPendentes.length >= RAG_DOCS_LIMIT ? "#f0b429" : wzMuted,
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
                    border: `1px dashed ${wizardDark ? RF.limao : "#c9a24a"}`,
                    borderRadius: 10,
                    padding: "14px 12px",
                    cursor: ragPendentes.length >= RAG_DOCS_LIMIT ? "not-allowed" : "pointer",
                    color: ragPendentes.length >= RAG_DOCS_LIMIT ? wzMuted : wzStrong,
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                    opacity: ragPendentes.length >= RAG_DOCS_LIMIT ? 0.7 : 1,
                  }}
                >
                  {ragPendentes.length >= RAG_DOCS_LIMIT
                    ? "Limite de documentos atingido"
                    : "Adicionar documento à fila"}
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
                    border: `1px solid ${wzDivider}`,
                    background: ragPreparando
                      ? wizardDark
                        ? "rgba(11, 31, 16, 0.72)"
                        : "#eef7eb"
                      : wizardDark
                        ? "rgba(146, 255, 0, 0.1)"
                        : "#c9a24a22",
                    color: ragPreparando ? wzMuted : wzStrong,
                    cursor: ragPreparando || ragPendentes.length === 0 ? "not-allowed" : "pointer",
                    opacity: ragPreparando || ragPendentes.length === 0 ? 0.7 : 1,
                  }}
                >
                  {ragPreparando
                    ? "A preparar documentos..."
                    : ragPreparados
                      ? "Preparar novamente"
                      : "Preparar documentos agora"}
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
                    Agente <strong style={{ color: wzStrong }}>{agenteSlugCriado}</strong> criado. Use{" "}
                    <strong style={{ color: wzStrong }}>Próximo</strong> para Revisão → Ferramentas → Materiais
                    {precisaPassoCanal ? " → Canal." : "."}
                  </p>
                ) : null}

                {ragPendentes.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        background: wizardDark ? "rgba(11, 31, 16, 0.72)" : "#eef7eb",
                        border: `1px solid ${wzDivider}`,
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
                              : "linear-gradient(90deg, #1f6feb 0%, #2d6a4f 100%)",
                          transition: "width 180ms ease",
                        }}
                      />
                    </div>
                    <p style={{ color: wzMuted, fontSize: 11, margin: "6px 0 0" }}>
                      {ragUploadTotal > 0
                        ? `Progresso do processamento: ${ragUploadDone}/${ragUploadTotal}`
                        : ragPendentes.some((i) => i.status === "concluido")
                          ? "Documentos indexados no servidor."
                          : ragPendentes.every((i) => i.status === "na_fila")
                            ? "Na fila — serão enviados ao criar o agente ou ao clicar em «Preparar documentos agora»."
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
                          border: `1px solid ${wzDivider}`,
                          borderRadius: 12,
                          padding: 12,
                          background: wizardDark ? "rgba(11, 31, 16, 0.72)" : "#f8fcf6",
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
                            background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#eef7eb",
                            border: `1px solid ${wzDivider}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: wzMuted,
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {ragDocExt(item.file.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              color: wzStrong,
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
                          <p style={{ color: wzMuted, fontSize: 11, margin: 0, lineHeight: 1.45 }}>
                            {formatBytes(item.file.size)} ·{" "}
                            <span
                              style={{
                                color:
                                  item.status === "concluido"
                                    ? "#3fb950"
                                    : item.status === "erro"
                                      ? "#f85149"
                                      : item.status === "processando"
                                        ? "#2d6a4f"
                                        : item.status === "preparado"
                                          ? "#c9a24a"
                                          : "#5d7a67",
                              }}
                            >
                              {item.status === "concluido"
                                ? "CONCLUÍDO"
                                : item.status === "erro"
                                  ? "ERRO"
                                  : item.status === "processando"
                                    ? "PROCESSANDO"
                                    : item.status === "preparado"
                                      ? "PREPARADO"
                                      : "NA FILA"}
                            </span>
                            {item.status === "na_fila"
                              ? " — ainda só no navegador"
                              : item.status === "preparado"
                                ? " — pronto para envio"
                                : ""}
                          </p>
                          {item.mensagem ? (
                            <p style={{ color: wzMuted, fontSize: 11, margin: "4px 0 0", lineHeight: 1.4 }}>
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
                            border: `1px solid ${wzDivider}`,
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
                  <p style={{ color: wzMuted, fontSize: 12, margin: "12px 0 0" }}>
                    Nenhum documento na fila. Opcional — a base geral da empresa vem de CRM → Conhecimento; use aqui só material exclusivo desta função.
                  </p>
                )}
              </div>
            </div>
          )}

          {passo === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[6].titulo}</h2>
                <p style={wzP}>
                  {wizardInterno
                    ? "Funcionário IA com harness superagente: dados da empresa, relatórios canvas e Mistral já vêm incluídos. O cargo define o que pode fazer; abaixo pode activar funções custom do escritório."
                    : AGENTE_WIZARD_STEP_INTRO[6].descricao}
                </p>
              </div>
              <AgenteFerramentasIaBlock
                theme={wizardDark ? "dark" : "light"}
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
                externaCatalog={catalogoExternaFerramentasWizard}
                integradorCatalog={integradorCatalogWizard}
                modoInterno={wizardInterno}
                destacarWhatsApp={wizardCanal && agenteEhModoCanal(modoOperacao)}
              />
              {precisaGoogleWorkspace && !wizardInterno ? (
                <div style={{ ...wizardInfoBox(), marginTop: 4 }}>
                  <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Agenda Google:</strong>{" "}
                  {googleNoPassoCanal
                    ? "no passo Canal + Agenda, ligue a conta Google da empresa (secção 2)."
                    : "no passo Agenda Google, autorize Gmail + Calendar."}
                </div>
              ) : wizardInterno ? (
                <div style={{ ...wizardInfoBox(), marginTop: 4 }}>
                  <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Próximo:</strong> no passo{" "}
                  <strong style={{ color: wzStrong }}>Harness</strong> o sistema gera skills (SKILL.md) e identidade a
                  partir das ferramentas activas — alinhado ao runtime Waje.
                </div>
              ) : null}
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
                  Agente <strong style={{ color: wzStrong }}>{agenteSlugCriado}</strong> já foi criado. Grave as
                  ferramentas abaixo e continue para{" "}
                  <strong style={{ color: wzStrong }}>{wizardInterno ? "Integrações" : "Materiais"}</strong>
                  {precisaPassoCanal ? ", Canal" : ""}
                  {googleNoPassoCanal ? " + Agenda Google" : precisaPassoGoogle ? " e Agenda Google" : ""}.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (wizardInterno && !agenteSlugCriado) {
                    setPasso(8);
                    return;
                  }
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
                disabled={
                  (!somentePlaybook && !cargoSelecionado) ||
                  !nome.trim() ||
                  criando ||
                  (!wizardInterno &&
                    !agenteSlugCriado &&
                    (harnessGerando || !harnessPromptGerado.trim()))
                }
                style={{
                  ...wizardBtnPrimary(
                    (!somentePlaybook && !cargoSelecionado) ||
                      !nome.trim() ||
                      criando ||
                      (!wizardInterno &&
                        !agenteSlugCriado &&
                        (harnessGerando || !harnessPromptGerado.trim())),
                    { fullWidth: true }
                  ),
                  padding: "14px 0",
                  fontSize: 14,
                  borderRadius: 10,
                  cursor: criando ? "wait" : undefined,
                }}
              >
                {criando
                  ? "A gravar…"
                  : wizardInterno && !agenteSlugCriado
                    ? "Continuar → Harness"
                    : harnessGerando && wizardInterno && !agenteSlugCriado
                    ? "A gerar harness…"
                    : agenteSlugCriado
                    ? wizardInterno
                      ? "Continuar → Integrações"
                      : "Continuar → Materiais"
                    : "Criar agente"}
              </button>
            </div>
          )}

          {passo === 8 && wizardInterno && cargoSelecionado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>Harness — skills e identidade</h2>
                <p style={wzP}>
                  Ordem RFC: ferramentas → skills executáveis (L0/L1) → prompt base. Revise antes de publicar o
                  hiperagente. O runtime injecta memória, modos e orquestração em cada turno.
                </p>
              </div>
              {harnessGerando ? (
                <p style={{ color: wzMuted, fontSize: 13, margin: 0 }}>A gerar skills e identidade…</p>
              ) : null}
              {harnessErro ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{harnessErro}</p>
                  <button
                    type="button"
                    onClick={() => void gerarHarnessInterno(cargoSelecionado)}
                    style={wizardOutline(false)}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}
              {harnessPromptGerado && !harnessGerando ? (
                <>
                  <p style={{ color: wizardDark ? "#92ff00" : "#2d6a4f", fontSize: 11, margin: 0 }}>
                    {harnessGeradoComIa
                      ? "✓ Identidade refinada com IA"
                      : "✓ Identidade determinística do catálogo"}{" "}
                    · {harnessSkills.length} skill(s) para <code>hub_agente_skills</code>
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {harnessSkills.map((s) => (
                      <div key={s.id} style={{ ...wzCard(), padding: 14 }}>
                        <p style={{ color: wzStrong, fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>
                          {s.titulo}{" "}
                          <span style={{ color: wzMuted, fontWeight: 500, fontSize: 11 }}>({s.id})</span>
                        </p>
                        <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>
                          {s.descricao}
                        </p>
                        {s.ferramentas_sugeridas?.length ? (
                          <p style={{ color: wzMuted, fontSize: 10, margin: 0 }}>
                            Tools: {s.ferramentas_sugeridas.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: wzMuted }}>
                      Ver prompt base (identidade)
                    </summary>
                    <pre
                      style={{
                        marginTop: 8,
                        padding: 12,
                        borderRadius: 8,
                        fontSize: 11,
                        lineHeight: 1.45,
                        maxHeight: 240,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        background: wizardDark ? "rgba(0,0,0,0.35)" : "#f4f7f5",
                        border: `1px solid ${wzDivider}`,
                        color: wzStrong,
                      }}
                    >
                      {harnessPromptGerado}
                    </pre>
                  </details>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={harnessAprovado}
                      onChange={(e) => setHarnessAprovado(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span style={{ color: wzStrong, fontSize: 12, lineHeight: 1.5 }}>
                      Aprovo as skills e a identidade deste hiperagente para publicação.
                    </span>
                  </label>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => void gerarHarnessInterno(cargoSelecionado)}
                      disabled={harnessGerando}
                      style={wizardOutline(harnessGerando)}
                    >
                      Regenerar com ferramentas actuais
                    </button>
                  </div>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setPasso(5)}
                disabled={
                  harnessGerando ||
                  !harnessPromptGerado.trim() ||
                  !harnessAprovado ||
                  harnessSkills.length === 0
                }
                style={wizardBtnPrimary(
                  harnessGerando ||
                    !harnessPromptGerado.trim() ||
                    !harnessAprovado ||
                    harnessSkills.length === 0,
                  { fullWidth: true }
                )}
              >
                Continuar → Revisão e criar agente
              </button>
            </div>
          )}

          {passo === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[5].titulo}</h2>
                <p style={wzP}>{AGENTE_WIZARD_STEP_INTRO[5].descricao}</p>
                {wizardInterno ? (
                  <p style={{ color: wzMuted, fontSize: 12, margin: "10px 0 0", lineHeight: 1.55 }}>
                    <strong style={{ color: wzStrong }}>Conhecimento:</strong> identidade e skills no passo Ferramentas;
                    dados operacionais via ferramentas CRM e base partilhada em{" "}
                    <strong style={{ color: wzStrong }}>CRM → Conhecimento</strong>. Sem playbook por agente.
                  </p>
                ) : (
                  <>
                    {ragPendentes.some((i) => i.status === "na_fila" || i.status === "preparado") ? (
                      <p style={{ color: "#c9a24a", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                        Documentos RAG pendentes:{" "}
                        <strong style={{ color: wzStrong }}>
                          {ragPendentes.filter((i) => i.status !== "concluido").length}
                        </strong>{" "}
                        (serão indexados ao confirmar a criação do agente, se ainda não processou no passo
                        Conhecimento).
                      </p>
                    ) : ragPendentes.some((i) => i.status === "concluido") ? (
                      <p style={{ color: "#3fb950", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                        Documentos RAG já indexados nesta sessão.
                      </p>
                    ) : null}
                    {WIZARD_CONHECIMENTO_SECOES.some((k) => conhecimentoSecoes[k].trim()) ? (
                      <p style={{ color: "#3fb950", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                        Conhecimento estruturado:{" "}
                        <strong style={{ color: wzStrong }}>
                          {WIZARD_CONHECIMENTO_SECOES.filter((k) => conhecimentoSecoes[k].trim()).length}
                        </strong>{" "}
                        seção(ões) preenchida(s) — irão para o playbook ao criar o agente.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {somentePlaybook ? (
                <div style={{ ...wzCard(), padding: 16 }}>
                  <p style={{ ...wizardSectionLabel, marginBottom: 6 }}>MODO INSTRUÇÃO</p>
                  <p style={{ color: wzStrong, fontSize: 14, fontWeight: 700, margin: 0 }}>
                    {CARGO_LABEL_PLAYBOOK_ONLY}
                  </p>
                  <p style={{ color: wzMuted, fontSize: 12, margin: "8px 0 0", lineHeight: 1.5 }}>
                    Sem cargo no catálogo — o playbook publicado é a fonte operacional.
                  </p>
                </div>
              ) : null}

              {cargoSelecionado && (
                <div style={{ ...wzCard(), padding: 16 }}>
                  <p style={{ ...wizardSectionLabel, marginBottom: 6 }}>CARGO SELECIONADO</p>
                  <p style={{ color: wzStrong, fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
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
                          background: (NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67") + "22",
                          color: NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67",
                          border: `1px solid ${(NIVEL_COR[cargoSelecionado.nivel] || "#5d7a67")}44`,
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
                          background: (SEGMENTO_COR[cargoSelecionado.segmento] || "#5d7a67") + "22",
                          color: SEGMENTO_COR[cargoSelecionado.segmento] || "#5d7a67",
                          border: `1px solid ${(SEGMENTO_COR[cargoSelecionado.segmento] || "#5d7a67")}44`,
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
                  <strong style={{ color: "#e3b341" }}>Modelo de IA no catálogo</strong>
                  <br />
                  Este cargo tem IDs de modelo incompatíveis. Ao criar o agente, será usado{" "}
                  <strong>{hubModeloExibicaoProduto("mistral")}</strong>. Atualize o catálogo se precisar de outro
                  modelo.
                </div>
              )}

              <div style={{ ...wzCard(), overflow: "hidden" }}>
                {[
                  { label: "Nome", value: nome || "—" },
                  {
                    label: "Instrução",
                    value: modoInstrucaoWizardResumo({
                      somentePlaybook,
                      temPlaybookCarregado: Boolean(playbookConteudoAnalise.trim()),
                      temCargo: Boolean(cargoSelecionado),
                    }),
                  },
                  { label: "Tipo de agente", value: modoOperacaoWizardResumo(modoOperacao) },
                  ...(!agenteEhModoCanal(modoOperacao)
                    ? [
                        {
                          label: "Modo de operação",
                          value:
                            modoExecucao === "interacao"
                              ? "Sob interação (copiloto / gestor)"
                              : modoExecucao === "agenda"
                                ? agendaModo === "horario_fixo"
                                  ? `Ciclo programado — diário às ${agendaHoraLocal} (BR)`
                                  : `Ciclo programado — a cada ${agendaIntervalMin} min`
                                : "Automático contínuo",
                        },
                      ]
                    : []),
                  ...(playbookConteudoAnalise.trim()
                    ? [
                        {
                          label: "Playbook (pré-criação)",
                          value: playbookArquivoNome || "Conteúdo carregado",
                        },
                      ]
                    : []),
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: `1px solid ${wzDivider}`,
                    }}
                  >
                    <span style={{ color: wzMuted, fontSize: 12 }}>{row.label}</span>
                    <span style={{ color: wzStrong, fontSize: 12, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...wzCard(), padding: 16 }}>
                <p style={{ ...wizardSectionLabel, marginBottom: 4 }}>TIPO DE AGENTE</p>
                <p style={{ color: wzStrong, fontSize: 13, fontWeight: 700, margin: "0 0 14px" }}>
                  {modoOperacaoWizardResumo(modoOperacao)}
                  <span style={{ color: wzMuted, fontWeight: 600, fontSize: 12 }}>
                    {" "}
                    — altere no passo Identidade se necessário.
                  </span>
                </p>

                {modoOperacao === "canal_whatsapp" ? (
                  <div style={{ ...wizardInfoBox(), marginBottom: 14 }}>
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Canal WhatsApp:</strong> recomendamos
                    activar resumo do lead, memórias e registo de nota. No passo seguinte (
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Ferramentas</strong>) estas opções
                    aparecem em destaque — avance com{" "}
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Próximo</strong>.
                  </div>
                ) : null}
                {isEmailChannelEnabledClient() && modoOperacao === "canal_email" ? (
                  <div style={{ ...wizardInfoBox(), marginBottom: 14 }}>
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Canal E-mail:</strong> no passo{" "}
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Canal</strong> configure remetente
                    Gmail OAuth — ligue a conta Google do agente. Recomendamos activar resumo do lead e registo de nota nas ferramentas.
                  </div>
                ) : null}

                <p style={{ ...wizardSectionLabel, marginBottom: 8 }}>TIPO DE EXECUÇÃO DO CICLO PADRÃO</p>
                <p
                  style={{
                    color: wzMuted,
                    fontSize: 12,
                    margin: "0 0 12px",
                    lineHeight: 1.5,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${wzDivider}`,
                    background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                  }}
                >
                  {modoOperacao === "jobs_internos" ? (
                    <>
                      O assistente interno partilha o <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>mesmo superagente</strong> no copiloto CRM, WhatsApp gestor e ciclos programados (dados, relatórios canvas, OCR). Escolha{" "}
                      <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>sob interação</strong> ou{" "}
                      <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>ciclo programado</strong> abaixo.
                    </>
                  ) : agenteEhModoCanal(modoOperacao) ? (
                    <>
                      O modelo será salvo como{" "}
                      <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>atendimento no canal</strong> e
                      provisiona ciclo de{" "}
                      <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>gatilho por interação</strong>{" "}
                      (cada mensagem recebida).
                    </>
                  ) : null}
                </p>

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
                        style={wizardChoicePill(at)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {hubCicloEstrategia === "somente_vincular" ? (
                  <p style={{ ...wizardInfoBox(), fontSize: 11, margin: "0 0 12px" }}>
                    Os ciclos escolhidos passam a usar o{" "}
                    <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>slug do novo agente</strong> e deixam
                    de contar para o agente anterior nesta tabela.
                  </p>
                ) : null}

                {hubCicloEstrategia === "provisionar" ? (
                  <>
                    {agenteEhModoCanal(modoOperacao) ? (
                      <p
                        style={{
                          color: wzMuted,
                          fontSize: 12,
                          margin: "0 0 12px",
                          lineHeight: 1.5,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: `1px solid ${wzDivider}`,
                          background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                        }}
                      >
                        Para atendimento no canal, o ciclo padrão é{" "}
                        <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>sob interação</strong> (gatilho a
                        cada mensagem recebida).
                      </p>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(
                        [
                          ...(agenteEhModoCanal(modoOperacao)
                            ? ([
                                {
                                  id: "interacao" as const,
                                  Icon: Webhook,
                                  titulo: "Sob interação",
                                  texto:
                                    "Dispara por interação no canal; não depende de cron para cada mensagem.",
                                },
                              ] as const)
                            : ([
                                {
                                  id: "interacao" as const,
                                  Icon: MessageSquare,
                                  titulo: "Sob interação",
                                  texto:
                                    "Activa quando alguém envia mensagem no copiloto CRM ou no WhatsApp do gestor. Sem execução automática por horário.",
                                },
                                {
                                  id: "agenda" as const,
                                  Icon: Clock,
                                  titulo: "Ciclo programado",
                                  texto:
                                    "Rotina automática (relatórios, análises). Defina horário ou intervalo abaixo. O ciclo é criado em pausa — active depois em Operação.",
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
                            style={wizardChoiceCard(ativo)}
                          >
                            <Ico
                              size={20}
                              color={ativo ? (wizardDark ? RF.limao : CRM_ACCENT) : wzMuted}
                              strokeWidth={2}
                              aria-hidden
                            />
                            <span>
                              <span
                                style={{
                                  display: "block",
                                  color: wzStrong,
                                  fontWeight: 700,
                                  fontSize: 13,
                                  marginBottom: 4,
                                }}
                              >
                                {opt.titulo}
                              </span>
                              <span style={{ color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                                {opt.texto}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {modoExecucao === "agenda" ? (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ ...wizardSectionLabel, margin: 0 }}>CADÊNCIA DO CICLO</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {(
                            [
                              { id: "horario_fixo" as const, label: "Horário fixo (diário)" },
                              { id: "intervalo" as const, label: "Repetir a cada…" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setAgendaModo(opt.id)}
                              style={wizardChoicePill(agendaModo === opt.id)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {agendaModo === "horario_fixo" ? (
                          <div>
                            <label
                              htmlFor="ciclo-hora-local-br"
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: wizardDark ? RF.limao : wzMuted,
                                display: "block",
                                marginBottom: 8,
                              }}
                            >
                              HORÁRIO (Brasil — America/Sao_Paulo)
                            </label>
                            <input
                              id="ciclo-hora-local-br"
                              type="time"
                              value={agendaHoraLocal}
                              onChange={(e) => setAgendaHoraLocal(e.target.value)}
                              style={{
                                ...wzInput,
                                padding: "10px 12px",
                                fontSize: 13,
                                maxWidth: 160,
                              }}
                            />
                            <p style={{ margin: "8px 0 0", fontSize: 11, color: wzMuted, lineHeight: 1.45 }}>
                              Ex.: 08:00 — o agente roda uma vez por dia nesse horário (após activar o ciclo).
                              {cronDiarioUtcFromHoraLocalBr(agendaHoraLocal) ? (
                                <>
                                  {" "}
                                  Cron UTC:{" "}
                                  <code style={{ fontSize: 10 }}>{cronDiarioUtcFromHoraLocalBr(agendaHoraLocal)}</code>
                                </>
                              ) : null}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label
                              htmlFor="ciclo-intervalo-agenda"
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: wizardDark ? RF.limao : wzMuted,
                                display: "block",
                                marginBottom: 8,
                              }}
                            >
                              REPETIR A CADA
                            </label>
                            <select
                              id="ciclo-intervalo-agenda"
                              value={agendaIntervalMin}
                              onChange={(e) =>
                                setAgendaIntervalMin(Number(e.target.value) as 15 | 60 | 360 | 1440)
                              }
                              style={{
                                ...wzInput,
                                padding: "10px 12px",
                                fontSize: 13,
                              }}
                            >
                              {AGENDA_INTERVALO_OPCOES.map((o) => (
                                <option key={o.min} value={o.min}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ) : modoExecucao === "interacao" && modoOperacao === "jobs_internos" ? (
                      <p
                        style={{
                          marginTop: 14,
                          fontSize: 12,
                          color: wzMuted,
                          lineHeight: 1.5,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: `1px solid ${wzDivider}`,
                          background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                        }}
                      >
                        Nenhum ciclo cron será criado — o agente fica disponível para conversa no{" "}
                        <strong style={{ color: wzStrong }}>briefing / copiloto</strong> e no menu do{" "}
                        <strong style={{ color: wzStrong }}>WhatsApp gestor</strong>.
                      </p>
                    ) : null}
                  </>
                ) : null}

                <div style={{ marginTop: hubCicloEstrategia === "provisionar" ? 16 : 0 }}>
                  <p style={{ ...wizardSectionLabel, marginBottom: 8 }}>
                    {hubCicloEstrategia === "somente_vincular"
                      ? "SELECIONAR CICLOS"
                      : "VINCULAR CICLOS EXISTENTES (OPCIONAL)"}
                  </p>
                  {hubCiclosCarregando ? (
                    <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>A carregar ciclos…</p>
                  ) : hubCiclosLista.length === 0 ? (
                    <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>
                      Nenhum ciclo configurado. Crie ciclos em CRM → Ciclos IA.
                    </p>
                  ) : (
                    <div
                      style={{
                        maxHeight: 220,
                        overflowY: "auto",
                        borderRadius: 10,
                        border: `1px solid ${wzDivider}`,
                        background: wizardDark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
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
                              borderBottom: `1px solid ${wizardDark ? RF.bordaSoft : "#eef7eb"}`,
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
                                  color: wzStrong,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {c.nome || "—"}
                              </span>
                              <span style={{ color: wzMuted, fontSize: 11, lineHeight: 1.45 }}>
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

              <div style={{ ...wzCard(), padding: 16 }}>
                <p style={{ ...wizardSectionLabel, marginBottom: 8 }}>PERSONALIDADE</p>
                <pre
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: wzMuted,
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
                <div style={{ ...wzCard(), overflow: "hidden" }}>
                  <p
                    style={{
                      color: wizardDark ? RF.limao : wzMuted,
                      fontSize: 11,
                      fontWeight: 700,
                      margin: 0,
                      padding: "12px 16px",
                      borderBottom: `1px solid ${wzDivider}`,
                    }}
                  >
                    RESUMO DO CARGO (ATENDIMENTO)
                  </p>
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${wzDivider}` }}>
                    <p
                      style={{
                        color: wizardDark ? RF.limao : CRM_ACCENT,
                        fontSize: 11,
                        fontWeight: 700,
                        margin: "0 0 4px",
                      }}
                    >
                      Saudação
                    </p>
                    <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>
                      {typeof cargoSelecionado.saudação_cliente === "string" && cargoSelecionado.saudação_cliente.trim()
                        ? cargoSelecionado.saudação_cliente.trim()
                        : "Sem saudação padrão no cargo."}
                    </p>
                  </div>
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${wzDivider}` }}>
                    <p
                      style={{
                        color: wizardDark ? RF.limao : CRM_ACCENT,
                        fontSize: 11,
                        fontWeight: 700,
                        margin: "0 0 4px",
                      }}
                    >
                      Comprimento
                    </p>
                    <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>
                      {typeof cargoSelecionado.comprimento_padrao === "string" && cargoSelecionado.comprimento_padrao.trim()
                        ? cargoSelecionado.comprimento_padrao.trim()
                        : "Sem comprimento padrão definido no cargo."}
                    </p>
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <p
                      style={{
                        color: wizardDark ? RF.limao : CRM_ACCENT,
                        fontSize: 11,
                        fontWeight: 700,
                        margin: "0 0 4px",
                      }}
                    >
                      Perguntas essenciais
                    </p>
                    {cargoSelecionado.usar_perguntas_essenciais === true ? (
                      splitLinesLite(cargoSelecionado.perguntas_essenciais).length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: 18, color: wzMuted, fontSize: 12, lineHeight: 1.5 }}>
                          {splitLinesLite(cargoSelecionado.perguntas_essenciais).slice(0, 5).map((p, idx) => (
                            <li key={`${p}-${idx}`}>{p}</li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>
                          Ativado no cargo, mas sem perguntas preenchidas.
                        </p>
                      )
                    ) : (
                      <p style={{ color: wzMuted, fontSize: 12, margin: 0 }}>
                        Este cargo não exige sequência de perguntas.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {wizardInterno && !agenteSlugCriado ? (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  disabled={
                    !cargoSelecionado ||
                    !nome.trim() ||
                    criando ||
                    !harnessAprovado ||
                    !harnessPromptGerado.trim() ||
                    harnessSkills.length === 0
                  }
                  style={{
                    ...wizardBtnPrimary(
                      !cargoSelecionado ||
                        !nome.trim() ||
                        criando ||
                        !harnessAprovado ||
                        !harnessPromptGerado.trim() ||
                        harnessSkills.length === 0,
                      { fullWidth: true }
                    ),
                    marginTop: 8,
                  }}
                >
                  {criando ? "A criar hiperagente…" : "Criar hiperagente empresarial"}
                </button>
              ) : null}
            </div>
          )}

          {passo === 7 && agenteSlugCriado && wizardInterno && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>Integrações</h2>
                <p style={wzP}>
                  Ligue as contas que o funcionário IA usa nas ferramentas:{" "}
                  <strong style={{ color: wzStrong }}>Google</strong> (Gmail + Agenda) e{" "}
                  <strong style={{ color: wzStrong }}>Mistral</strong> (OCR, áudio e visão). Abaixo vê o estado de
                  todas as integrações do escritório.
                </p>
              </div>

              <div style={{ ...wzCard(), padding: 16 }}>
                <p style={{ ...wizardSectionLabel, marginBottom: 10 }}>AGENTE CRIADO</p>
                <p style={{ color: wzStrong, fontSize: 14, fontWeight: 700, margin: "0 0 8px", wordBreak: "break-all" }}>
                  {nome || agenteSlugCriado}{" "}
                  <span style={{ color: wzMuted, fontWeight: 600, fontSize: 12 }}>({agenteSlugCriado})</span>
                </p>
                <a
                  href={`/crm/agentes/${encodeURIComponent(agenteSlugCriado)}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: wizardDark ? RF.limao : "#2d6a4f",
                    textDecoration: "none",
                  }}
                >
                  Abrir ficha do agente →
                </a>
              </div>

              <AgenteWizardIntegracoesInternoPanel
                agenteSlug={agenteSlugCriado}
                agenteNome={nome}
                theme={wizardDark ? "dark" : "light"}
                contextoGoogle={recomendaGoogleWorkspace ? "agendamento" : "padrao"}
                usoFerramentas={mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa)}
                onUsoChange={(id, ativo) =>
                  setUsoFerramentasIa((prev) => ({
                    ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                    [id]: ativo,
                  }))
                }
                onUsoSynced={(patch) =>
                  setUsoFerramentasIa((prev) => ({
                    ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                    ...patch,
                  }))
                }
                googleOauthEmail={googleOauthEmail}
                onOauthEmail={setGoogleOauthEmail}
              />
            </div>
          )}

          {passo === 7 && agenteSlugCriado && !wizardInterno && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[7].titulo}</h2>
                <p style={wzP}>
                  {AGENTE_WIZARD_STEP_INTRO[7].descricao}
                  {precisaPassoCanal
                    ? " Use ← Anterior no passo Canal para voltar antes de concluir."
                    : ""}
                </p>
              </div>

              <div style={{ ...wzCard(), padding: 16 }}>
                <p style={{ ...wizardSectionLabel, marginBottom: 10 }}>AGENTE CRIADO</p>
                <p style={{ color: wzStrong, fontSize: 14, fontWeight: 700, margin: "0 0 8px", wordBreak: "break-all" }}>
                  {nome || agenteSlugCriado}{" "}
                  <span style={{ color: wzMuted, fontWeight: 600, fontSize: 12 }}>({agenteSlugCriado})</span>
                </p>
                <a
                  href={`/crm/agentes/${encodeURIComponent(agenteSlugCriado)}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: wizardDark ? RF.limao : "#2d6a4f",
                    textDecoration: "none",
                  }}
                >
                  Abrir ficha do agente →
                </a>
              </div>

              {playbookMetaLoading && (
                <p style={{ color: wzMuted, fontSize: 13, margin: 0 }}>A ler estado do playbook…</p>
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

              {playbookUploadStatus === "sucesso" && playbookPublicUrl ? (
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
                  Playbook publicado no Storage. Pode reenviar outro arquivo abaixo para substituir.
                </p>
              ) : null}
              {playbookConteudoAnalise.trim() && whatsappFlowAgent ? (
                <PlaybookFlowStatusBanner status={playbookFlowStatus} compact />
              ) : null}

              <PlaybookUploadAnalisePanel
                inputId={PLAYBOOK_INPUT_POS}
                theme={playbookPanelTheme}
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
                progressoContexto={playbookArquivoNome || undefined}
                onHoverChange={(hover) => {
                  if (playbookUploadStatus !== "enviando") {
                    setPlaybookUploadStatus(hover ? "hover" : "idle");
                  }
                }}
                onFileSelect={(file) => void salvarPlaybookPorUpload(file)}
                onAnalisar={() => void analisarPlaybookComMistral()}
                onCancelarAnalise={cancelarAnalisePlaybook}
                onLimparArquivo={limparPlaybookCarregado}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => void aplicarTemplateWajeV1NoWizard()}
                  disabled={playbookUploadStatus === "enviando" || playbookAnaliseLoading}
                  style={wizardOutline(playbookUploadStatus === "enviando" || playbookAnaliseLoading)}
                >
                  Aplicar template Waje v1
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
                  <p style={{ ...wizardSectionLabel, marginBottom: 6 }}>PLAYBOOK PÚBLICO</p>
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
                <p style={{ color: wzMuted, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  Ainda não há playbook no Storage para este agente. Use o botão abaixo para gerar.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void gerarPlaybookNoStorage()}
                disabled={playbookGerando || playbookMetaLoading}
                style={{
                  ...wizardBtnPrimary(playbookGerando || playbookMetaLoading, { fullWidth: true }),
                  padding: "14px 0",
                  fontSize: 14,
                  borderRadius: 10,
                  cursor: playbookGerando || playbookMetaLoading ? "wait" : "pointer",
                }}
              >
                {playbookGerando ? "A gerar playbook…" : "Gerar playbook no Storage"}
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

          {passo === 8 && agenteSlugCriado && precisaPassoCanal && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[8].titulo}</h2>
                <p style={wzP}>
                  {agenteWizardPasso8Descricao(
                    modoOperacao,
                    isEmailChannelEnabledClient(),
                    googleNoPassoCanal
                  )}
                </p>
                {googleNoPassoCanal ? (
                  <p style={{ color: wzMuted, fontSize: 12, margin: "10px 0 0", lineHeight: 1.55 }}>
                    <strong style={{ color: wzStrong }}>Secção 1</strong> — WhatsApp.{" "}
                    <strong style={{ color: wzStrong }}>Secção 2</strong> — agenda Google da empresa (reservas e
                    Meet).
                  </p>
                ) : null}
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

              {hubCicloEstrategia === "somente_vincular" ? (
                <div style={{ ...wizardInfoBox(), padding: "12px 14px", lineHeight: 1.55 }}>
                  <strong style={{ color: wizardDark ? RF.limao : CRM_ACCENT }}>Ciclos vinculados:</strong> associou
                  ciclos existentes da Central a este agente. Confirme no painel UAZAPI que o{" "}
                  <strong style={{ color: wzStrong }}>webhook</strong> aponta para{" "}
                  <code style={{ fontSize: 11, color: wizardDark ? "#93c5fd" : "#93c5fd" }}>
                    /api/whatsapp/webhook
                  </code>{" "}
                  e que a instância abaixo fica <strong style={{ color: wzStrong }}>connected</strong> — só assim as
                  mensagens disparam a IA neste modelo.
                </div>
              ) : null}

              {syncCanalLoading ? (
                <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
                  A gravar modo de canal e configuração no agente…
                </p>
              ) : null}
              {modoOperacao === "canal_whatsapp" ? (
                <>
                  {googleNoPassoCanal ? (
                    <p style={{ ...wizardSectionLabel, margin: "4px 0 8px" }}>SECÇÃO 1 · WHATSAPP</p>
                  ) : null}
                  <AgenteUazapiBlock
                  layout="painel"
                  agenteNome={nome.trim() || agenteSlugCriado}
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
                  <p style={{ ...wizardSectionLabel, margin: "16px 0 8px" }}>SECÇÃO · FOLLOW-UP WHATSAPP</p>
                  <p style={{ color: wzMuted, fontSize: 12, margin: "0 0 10px", lineHeight: 1.55 }}>
                    Lembretes automáticos após silêncio do cliente (3 passos padrão já criados). Ative, edite textos
                    e imagens abaixo — ou depois em Agentes → Integrações.
                  </p>
                  <AgenteFollowupBlock
                    layout="embedded"
                    agenteSlug={agenteSlugCriado}
                    agenteNome={nome.trim() || agenteSlugCriado}
                  />
                </>
              ) : null}
              {isEmailChannelEnabledClient() && modoOperacao === "canal_email" ? (
                <AgenteEmailConnectBlock
                  layout="painel"
                  agenteNome={nome.trim() || agenteSlugCriado}
                  agenteSlug={agenteSlugCriado}
                  bloqueado={syncCanalLoading}
                  snapshot={
                    emailSnap ?? {
                      email_from: null,
                      email_from_name: null,
                      email_inbound: null,
                      email_ativo: true,
                    }
                  }
                  onSnapshotPatch={(patch) =>
                    setEmailSnap((prev) => ({
                      ...(prev ?? {
                        email_from: null,
                        email_from_name: null,
                        email_inbound: null,
                        email_ativo: true,
                      }),
                      ...patch,
                    }))
                  }
                />
              ) : null}

              {googleNoPassoCanal && agenteSlugCriado ? (
                <AgenteGoogleWorkspaceBlock
                  agenteSlug={agenteSlugCriado}
                  theme={wizardDark ? "dark" : "light"}
                  contexto={recomendaGoogleWorkspace ? "agendamento" : "padrao"}
                  secaoIndice={2}
                  usoFerramentas={mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa)}
                  oauthEmail={googleOauthEmail}
                  onOauthEmail={setGoogleOauthEmail}
                  onUsoSynced={(patch) =>
                    setUsoFerramentasIa((prev) => ({
                      ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                      ...patch,
                    }))
                  }
                />
              ) : null}
            </div>
          )}

          {passo === 9 && agenteSlugCriado && precisaPassoGoogle ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={wzH2}>{AGENTE_WIZARD_STEP_INTRO[9].titulo}</h2>
                <p style={wzP}>{AGENTE_WIZARD_STEP_INTRO[9].descricao}</p>
                {googleOauthEmail ? (
                  <p style={{ color: "#3fb950", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Conta Google autorizada: <strong style={{ color: wzStrong }}>{googleOauthEmail}</strong>
                  </p>
                ) : null}
              </div>

              <AgenteGoogleWorkspaceBlock
                agenteSlug={agenteSlugCriado}
                theme={wizardDark ? "dark" : "light"}
                contexto={recomendaGoogleWorkspace ? "agendamento" : "padrao"}
                usoFerramentas={mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentasIa)}
                oauthEmail={googleOauthEmail}
                onOauthEmail={setGoogleOauthEmail}
                onUsoSynced={(patch) =>
                  setUsoFerramentasIa((prev) => ({
                    ...mergeUsoFerramentasComPadraoPreservandoCustom(prev),
                    ...patch,
                  }))
                }
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            {passo > 0 && (
              <button
                type="button"
                onClick={() => setPasso((p) => wizardPassoAnterior(p, wizardInterno))}
                style={wizardBtnSecondary()}
              >← Anterior
              </button>
            )}
            {passo < 6 && !(wizardInterno && passo === 5) && (
              <button
                type="button"
                onClick={() => setPasso((p) => wizardPassoProximo(p, wizardInterno))}
                disabled={
                  passo === 0
                    ? !tipoWizard
                    : passo === 1
                      ? passo1AvancarBloqueado
                      : passo === 2
                        ? !nome.trim()
                        : false
                }
                style={wizardBtnPrimary(
                  (passo === 0 && !tipoWizard) ||
                    (passo === 1 && passo1AvancarBloqueado) ||
                    (passo === 2 && !nome.trim())
                )}
              >
                Próximo →
              </button>
            )}
            {passo === 7 && agenteSlugCriado && precisaPassoCanal ? (
              <button
                type="button"
                onClick={() => setPasso(8)}
                style={wizardBtnPrimary()}
              >
                Continuar → {googleNoPassoCanal ? "Canal + Agenda" : "Canal"}
              </button>
            ) : null}
            {passo === 7 && agenteSlugCriado && !precisaPassoCanal && precisaPassoGoogle ? (
              <button
                type="button"
                onClick={() => setPasso(9)}
                style={wizardBtnPrimary()}
              >
                Continuar → Google
              </button>
            ) : null}
            {passo === 7 && agenteSlugCriado && !precisaPassoCanal && !precisaPassoGoogle ? (
              <button
                type="button"
                onClick={concluirPosCriacao}
                style={wizardBtnPrimary()}
              >
                Concluir
              </button>
            ) : null}
            {passo === 8 && precisaPassoCanal ? (
              <button
                type="button"
                onClick={concluirPosCriacao}
                style={wizardBtnPrimary()}
              >
                Concluir
              </button>
            ) : null}
            {passo === 9 && precisaPassoGoogle ? (
              <button
                type="button"
                onClick={concluirPosCriacao}
                style={wizardBtnPrimary()}
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
          {precisaPassoCanal
            ? `O agente já foi criado. Pode configurar o canal (WhatsApp${isEmailChannelEnabledClient() ? " ou e-mail" : ""}), gerar playbook e ajustar integrações mais tarde na ficha do modelo.`
            : "O agente já foi criado. Pode ajustar integrações e ciclos mais tarde na ficha do modelo."}
        </p>
      </CrmConfirmDialog>
    </div>
  );
}

