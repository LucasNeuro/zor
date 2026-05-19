"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Clock, MessageSquare, Webhook, Zap } from "lucide-react";
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
  RAG_ACCEPT_ATTR,
  RAG_EXEMPLO_MD_URL,
  RAG_FORMATOS_RESUMO,
  ragErroPdfSemTexto,
  ragExtensaoAceita,
} from "@/lib/hub/rag-formatos";

// ─── Constants ────────────────────────────────────────────────────────────────

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];

/** Passos do assistente — após «Ferramentas» e criar agente, passos 7–8 são pós-criação. */
const WIZARD_STEP_LABELS = [
  "Cargo",
  "Identidade",
  "Personalidade",
  "Conhecimento",
  "Revisão",
  "Ferramentas",
  "Materiais",
  "Canal",
] as const;

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
      "Molde de estrutura — adapte ao cargo escolhido (título, nível, especialidade); o texto final não é genérico.\n\n## 1. Objetivo\nUma linha: o que este agente cumpre neste canal para este papel.\n\n## 2. Escopo\nUma linha: o que trata | o que fica fora.\n\n## 3. Triagem ou classificação\nUma linha | Tipo | Quando | (preencha 3–6 linhas quando tiver casos reais).\n\n## 4. Dados ou perguntas obrigatórias\nUma linha → depois lista numerada concreta.\n\n## 5. Critérios\nUma linha: prioridade | quando encerrar vs encaminhar.\n\n## 6. Próximos passos e SLA\nUma linha.\n\n## 7. Escalação para humano\nUma linha: quando e como passar a uma pessoa.",
  },
  {
    id: "empresa",
    label: "Sobre o negócio",
    placeholder: "## Quem somos / missão\nUma linha.\n\n## Diferenciais e valor\nBullets curtos ou uma linha.",
  },
  {
    id: "servicos",
    label: "Serviços",
    placeholder: "Lista: serviço | para quem | prazo ou garantia se souber — senão [completar].",
  },
  {
    id: "atendimento",
    label: "Como atender",
    placeholder: "Fluxo em poucos passos, perguntas-chave, tom, quando escalar — alinhado ao cargo.",
  },
  {
    id: "proibicoes",
    label: "Nunca fazer",
    placeholder: "Bullets: o que não prometer nem fazer neste cargo (dados, preços, temas vedados…).",
  },
  {
    id: "objeccoes",
    label: "Objeções comuns",
    placeholder: "Objeção → resposta curta de exemplo (5–8 pares).",
  },
  {
    id: "exemplos",
    label: "Exemplos de atendimento",
    placeholder: "2–4 trechos: pergunta do cliente / resposta do agente (tonalidade do cargo).",
  },
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

const RAG_DOCS_LIMIT = 3;

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
        border: "1px solid rgba(88,166,255,0.35)",
        background: "rgba(88,166,255,0.08)",
        color: "#adbac7",
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      {pdf ? (
        <p style={{ margin: "0 0 8px" }}>
          <strong style={{ color: "#58a6ff" }}>PDF sem texto seleccionável.</strong> Muitos PDFs criados com
          &quot;Imprimir&quot; ou digitalizados não indexam. Use{" "}
          <a
            href={RAG_EXEMPLO_MD_URL}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#58a6ff", fontWeight: 700 }}
          >
            o ficheiro .md de exemplo
          </a>{" "}
          ou exporte o mesmo conteúdo em <strong style={{ color: "#e6edf3" }}>.docx</strong> /{" "}
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

  /** Padrão recomendado: copiloto interno. */
  const [modoOperacao, setModoOperacao] = useState<ModoOperacaoAgente>("jobs_internos");
  /** Onde/quando opera: gravado como hub_ciclos_ia. */
  const [modoExecucao, setModoExecucao] = useState<"interacao" | "tempo_real" | "agenda">("agenda");
  const [agendaIntervalMin, setAgendaIntervalMin] = useState<15 | 60 | 360 | 1440>(60);

  /** `provisionar`: cria linha padrão + opcional vincular mais; `somente_vincular`: só atualiza slugs em hub_ciclos_ia. */
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

  /** Preenchido após POST bem-sucedido em `/api/hub/agentes`. */
  const [agenteSlugCriado, setAgenteSlugCriado] = useState<string | null>(null);
  const [uazapiSnap, setUazapiSnap] = useState<AgenteUazapiSnapshot | null>(null);
  const [playbookMetaLoading, setPlaybookMetaLoading] = useState(false);
  const [playbookGerando, setPlaybookGerando] = useState(false);
  const [playbookErro, setPlaybookErro] = useState("");
  const [playbookPublicUrl, setPlaybookPublicUrl] = useState<string | null>(null);
  /** Escolhidos no passo Conhecimento; enviados e indexados logo após «Criar agente». */
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
        if (!cargoSelecionado || !nome.trim()) {
          setRagPendenteErro("Preencha cargo e nome antes de processar embeddings.");
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

  function concluirPosCriacao() {
    if (variant === "drawer" && onClose) onClose();
    else router.push("/crm/agentes");
  }

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

  /** Grava no servidor o que o utilizador escolheu no wizard (modo, ciclos, conhecimento, ferramentas). */
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
        system_prompt_base: montarPrompt(conhecimento),
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

  async function criarAgente(opts?: { avancarPasso?: boolean }) {
    const avancarPasso = opts?.avancarPasso ?? true;
    if (!cargoSelecionado) return;
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
        cargo_slug: cargoSelecionado.slug,
        nome,
        prefixo_mercado: mercados.join(","),
        personalidade: gerarPersonalidade(valores),
        system_prompt_base: montarPrompt(conhecimento),
        conhecimento_secoes: conhecimento,
        bio: (conhecimento.empresa?.trim() || conhecimento.fluxo_sdr?.trim() || "").slice(0, 200),
        horario_inicio: "08:00",
        horario_fim: "22:00",
        motor_ferramentas_habilitado: motorFerramentasHub,
        mistral_agent_sync_habilitado: mistralProvisionar,
        uso_ferramentas_ia: usoFerramentasIa,
      };

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
          console.error("[CRM] Agent criado mas ciclo padrão falhou:", data.ciclo_erro);
        } else if (data.ciclo_aviso) {
          console.warn("[CRM]", data.ciclo_aviso);
        }

        if (slug) {
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
              Confirmar criação do agente <strong style={{ color: "#e6edf3" }}>{nome}</strong>? Em seguida passará por
              Materiais (playbook) e, se aplicável, Canal (WhatsApp UAZAPI).
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
              ←
            </button>
          </div>
          {cargoSelecionado && nome && (
            <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>
              {nome} · {cargoSelecionado.titulo}
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
                    {passado ? "✓" : num}
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
                  Preencha as secções que desejar — o agente usará estas informações. Os textos de exemplo
                  são <strong style={{ color: "#adbac7" }}>estrutura guia</strong>, não conteúdo final:
                  use o <strong style={{ color: "#adbac7" }}>cargo</strong> que escolheu (título, nível,
                  especialidade) e preencha por cima. &quot;Gerar com IA&quot; também ancora no cargo em
                  JSON. Opcionalmente, anexe até {RAG_DOCS_LIMIT} documentos abaixo para RAG (processados ao
                  clicar em «Criar agente» no passo Ferramentas).
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
                  {s.id === "fluxo_sdr" && (
                    <p
                      style={{
                        color: "#8b949e",
                        fontSize: 12,
                        margin: "0 0 8px",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: "#adbac7" }}>Adaptar ao cargo:</strong> cada bloco abaixo é
                      só guia de estrutura. Substitua por regras reais do papel (suporte, operações,
                      comercial, etc.) — não deixe texto que serviria para qualquer função.
                    </p>
                  )}
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

              <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                      Documentos para RAG (embeddings)
                    </p>
                    <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 12px", lineHeight: 1.55 }}>
                      Até <strong style={{ color: "#adbac7" }}>{RAG_DOCS_LIMIT} ficheiros</strong>. Primeiro ficam só
                      no navegador; o envio ao servidor exige um agente criado. Pode indexar já com{" "}
                      <strong style={{ color: "#adbac7" }}>Processar embeddings</strong> (cria o agente se ainda não
                      existir, sem saltar etapas) ou deixar na fila e concluir no passo{" "}
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
                    <strong style={{ color: "#e6edf3" }}>Próximo</strong> para Revisão → Ferramentas → Materiais → Canal.
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
                            ? "Na fila local — clique em «Processar embeddings agora» ou conclua com «Criar agente»."
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
                            {formatBytes(item.file.size)} ·{" "}
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
                    Nenhum documento na fila. Isto é opcional — o conhecimento por secções acima continua a valer.
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
                  Ligue o motor e active as funções que o Mistral pode pedir ao servidor (lead na sessão). Inclui o catálogo{" "}
                  <strong style={{ color: "#aebccf" }}>builtin</strong> e as ferramentas{" "}
                  <strong style={{ color: "#c9a24a" }}>custom</strong> activas do tenant. Se escolheu{" "}
                  <strong style={{ color: "#aebccf" }}>WhatsApp</strong> no passo anterior, as sugestões para esse canal
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
                  Agente <strong style={{ color: "#e6edf3" }}>{agenteSlugCriado}</strong> já foi criado (ex.: ao
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
                disabled={!cargoSelecionado || !nome.trim() || criando}
                style={{
                  padding: "14px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  background: "#003b26",
                  border: "none",
                  color: "#c9a24a",
                  cursor: !cargoSelecionado || !nome.trim() || criando ? "not-allowed" : "pointer",
                  opacity: !cargoSelecionado || !nome.trim() || criando ? 0.4 : 1,
                }}
              >
                {criando
                  ? "A gravar…"
                  : agenteSlugCriado
                    ? "Continuar → Materiais"
                    : "Criar agente"}
              </button>
            </div>
          )}

          {passo === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Revisão
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
                  Confira identidade, conhecimento e como o copiloto opera (canal e ciclos). Depois configure as ferramentas
                  e crie o agente.
                </p>
                {ragPendentes.some((i) => i.status === "na_fila" || i.status === "preparado") ? (
                  <p style={{ color: "#c9a24a", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Documentos RAG pendentes:{" "}
                    <strong style={{ color: "#e6edf3" }}>
                      {ragPendentes.filter((i) => i.status !== "concluido").length}
                    </strong>{" "}
                    (serão indexados ao confirmar a criação do agente, se ainda não processou no passo Conhecimento).
                  </p>
                ) : ragPendentes.some((i) => i.status === "concluido") ? (
                  <p style={{ color: "#3fb950", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Documentos RAG já indexados nesta sessão.
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
                  <strong style={{ color: "#e3b341" }}>Modelo de IA no catálogo</strong>
                  <br />
                  Este cargo tem IDs de modelo que o Postgres não aceita na tabela de identidade. Ao criar o agente, o
                  servidor grava <strong>mistral</strong> nesses campos (sinónimo do modelo definido em{" "}
                  <code style={{ fontSize: 11 }}>MISTRAL_MODEL</code> no servidor). Atualize o catálogo se quiser
                  manter outro fabricante explicitamente.
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
                  COMO O COPILOTO RODA
                </p>
                <p style={{ color: "#6e7781", fontSize: 12, margin: "0 0 14px", lineHeight: 1.5 }}>
                  Aqui você define se o modelo <strong style={{ color: "#aebccf" }}>atende no canal</strong> (WhatsApp
                  legado) ou se fica só em <strong style={{ color: "#aebccf" }}>operações internas</strong> por ciclos.
                  Por padrão recomendamos o copiloto interno; use o canal quando precisar de fila de atendimento ao vivo.
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
                    memórias e registo de nota. No passo seguinte (<strong style={{ color: "#c9a24a" }}>Ferramentas</strong>
                    ) estas opções aparecem em destaque — avance com <strong style={{ color: "#c9a24a" }}>Próximo</strong>.
                  </div>
                ) : null}

                <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>
                  TIPO DE EXECUÇÃO DO CICLO PADRÃO
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
                      O modelo será salvo como <strong style={{ color: "#c9a24a" }}>jobs_internos</strong> e já
                      provisiona um ciclo padrão em <code style={{ color: "#8b949e" }}>hub_ciclos_ia</code>.
                    </>
                  ) : (
                    <>
                      O modelo será salvo como <strong style={{ color: "#c9a24a" }}>canal_whatsapp</strong> —
                      modo <strong style={{ color: "#c9a24a" }}>atendimento no canal</strong> — e provisiona ciclo de{" "}
                      <strong style={{ color: "#c9a24a" }}>gatilho por interação</strong> (cada mensagem no webhook).
                    </>
                  )}
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
                        Para atendimento no WhatsApp (legado), o ciclo padrão é{" "}
                        <strong style={{ color: "#c9a24a" }}>sob interação</strong> (gatilho a cada mensagem no canal).
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
                                  titulo: "Sob interação",
                                  texto:
                                    "Dispara por interação no canal; não depende de cron para cada mensagem.",
                                },
                              ] as const)
                            : ([
                                {
                                  id: "tempo_real" as const,
                                  Icon: Zap,
                                  titulo: "Automático contínuo",
                                  texto:
                                    "Motor interno em ciclo contínuo. Útil para supervisão e rotinas sem horário fixo.",
                                },
                                {
                                  id: "agenda" as const,
                                  Icon: Clock,
                                  titulo: "Horário fixo / recorrente",
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
            </div>
          )}

          {passo === 7 && agenteSlugCriado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Materiais (playbook)
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  Gera um ficheiro no Storage com o conhecimento deste agente, para ferramentas ou equipas que precisem
                  do playbook num URL estável. Se já passou pelo passo Canal (WhatsApp), use <strong style={{ color: "#aebccf" }}>← Anterior</strong> a partir desse ecrã para voltar aqui antes de concluir.
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
                  Abrir ficha do agente →
                </a>
              </div>

              {playbookMetaLoading && (
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>A ler estado do playbook…</p>
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
                    PLAYBOOK PÚBLICO
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
                  Ainda não há playbook no Storage para este agente. Use o botão abaixo para gerar.
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

          {passo === 8 && agenteSlugCriado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h2 style={{ color: "#e6edf3", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                  Canal
                </h2>
                <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  {modoOperacao === "canal_whatsapp"
                    ? "Ligue o WhatsApp via UAZAPI (instância e QR/pairing). O token da API não é mostrado aqui."
                    : "Este agente está em modo copiloto interno (jobs por ciclo). Não há WhatsApp neste fluxo — pode concluir e gerir ciclos na Central ou na ficha do agente."}
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
                  para <code style={{ fontSize: 11, color: "#93c5fd" }}>/api/whatsapp/webhook</code> e que a instância
                  abaixo fica <strong style={{ color: "#e6edf3" }}>connected</strong> — só assim as mensagens disparam a
                  IA neste modelo.
                </div>
              ) : null}

              {modoOperacao === "canal_whatsapp" ? (
                <>
                  {syncCanalLoading ? (
                    <p style={{ color: "#8b949e", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
                      A gravar modo WhatsApp e configuração no agente…
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
                    onRefresh={() => refreshSnapshotUazapi()}
                  />
                </>
              ) : (
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 16 }}>
                  <p style={{ color: "#8b949e", fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                    Para ativar WhatsApp mais tarde, abra a ficha do agente e altere o modo de operação / ciclo ou use o
                    bloco UAZAPI na área de integrações.
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
                ← Anterior
              </button>
            )}
            {passo < 6 && (
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
                Continuar → Canal
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
          O agente já foi criado. Pode ligar o WhatsApp, gerar playbook e ajustar o canal mais tarde na ficha do
          modelo.
        </p>
      </CrmConfirmDialog>
    </div>
  );
}
