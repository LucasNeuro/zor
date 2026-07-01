/**
 * Gera o bloco de texto <system_capability> a partir dos toolsets activos.
 * Descreve em prosa apenas as capacidades disponíveis nesta sessão.
 */
import { HARNESS_TOOLSETS, type HarnessToolsetId } from "@/lib/harness/toolsets";
import { TOOL_NAMESPACE_MAP, type ToolFamily } from "@/lib/harness/tools/tool-namespace-map";

/**
 * Mapeamento de toolset → descrição amigável para o bloco de capacidade.
 * Usamos descrições mais ricas do que as do catálogo HARNESS_TOOLSETS para o prompt.
 */
const TOOLSET_CAPABILITY_TEXT: Record<HarnessToolsetId, string> = {
  crm_operacoes:
    "Consultar e gravar entidades CRM operacionais (leads, negócios, financeiro, notas, actividades, propostas)",
  crm_relatorios:
    "Gerar relatórios tabulares, views agregadas e análises de dados do CRM",
  artefatos:
    "Publicar dashboards canvas HTML com KPIs, gráficos Chart.js e URL pública partilhável",
  multimodal:
    "Processar imagens (OCR, Q&A visual), documentos PDF e transcrição de áudio via Mistral",
  metricas:
    "Consultar KPIs e indicadores operacionais do escritório (pipeline, conversão, receita)",
  memoria:
    "Persistir e recuperar memória curada entre sessões (Mem0 semântico + harness_memory)",
  skills_harness:
    "Carregar runbooks de skills (L0/L1), delegar a agentes especializados e pesquisar histórico de conversas",
};

/**
 * Labels humanizadas para integrações externas comuns.
 * Chave = nome da ferramenta externa (extDefNomes) ou parte do nome.
 */
const EXT_INTEGRATION_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /gmail/i, label: "Gmail" },
  { match: /google.?calendar/i, label: "Google Calendar" },
  { match: /google.?drive/i, label: "Google Drive" },
  { match: /whatsapp/i, label: "WhatsApp" },
  { match: /slack/i, label: "Slack" },
  { match: /hubspot/i, label: "HubSpot" },
  { match: /pipedrive/i, label: "Pipedrive" },
  { match: /notion/i, label: "Notion" },
  { match: /stripe/i, label: "Stripe" },
];

function labelParaIntegracao(nomeFerramentaExt: string): string {
  for (const { match, label } of EXT_INTEGRATION_LABELS) {
    if (match.test(nomeFerramentaExt)) return label;
  }
  // Fallback: capitaliza o nome da ferramenta
  return nomeFerramentaExt
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Gera o texto do bloco `<system_capability>` descrevendo apenas as capacidades activas.
 *
 * @param toolsetsAtivos  IDs dos toolsets habilitados para esta sessão.
 * @param intDefNomes     Nomes de integrações internas adicionais (optional).
 * @param extDefNomes     Nomes de integrações externas OAuth activas (optional).
 * @returns               Texto em prosa para inserir no system prompt.
 */
export function gerarCapabilityBloco(
  toolsetsAtivos: HarnessToolsetId[],
  intDefNomes?: string[],
  extDefNomes?: string[]
): string {
  if (toolsetsAtivos.length === 0 && !extDefNomes?.length && !intDefNomes?.length) {
    return "Nesta sessão não tens ferramentas adicionais activas.";
  }

  const linhas: string[] = ["Nesta sessão tens acesso às seguintes capacidades:"];

  // Toolsets activos → descrição curada
  const toolsetTexts = toolsetsAtivos
    .map((id) => TOOLSET_CAPABILITY_TEXT[id])
    .filter(Boolean);

  // Deduplicar (skills_harness e memoria partilham prefixo "harness")
  const seen = new Set<string>();
  for (const txt of toolsetTexts) {
    if (!seen.has(txt)) {
      seen.add(txt);
      linhas.push(`- ${txt}`);
    }
  }

  // Integrações externas (OAuth)
  if (extDefNomes && extDefNomes.length > 0) {
    const labels = extDefNomes.map(labelParaIntegracao);
    linhas.push(`- Integrações activas: ${labels.join(", ")}`);
  }

  // Integrações internas adicionais não cobertas pelos toolsets
  if (intDefNomes && intDefNomes.length > 0) {
    const toolsetFerrs = new Set<string>(
      toolsetsAtivos.flatMap((id) => {
        const ts = HARNESS_TOOLSETS.find((t) => t.id === id);
        return ts?.ferramentas ?? [];
      })
    );
    const extra = intDefNomes.filter((n) => !toolsetFerrs.has(n));
    if (extra.length > 0) {
      const extraLabels = extra.map(labelParaIntegracao);
      linhas.push(`- Ferramentas internas adicionais: ${extraLabels.join(", ")}`);
    }
  }

  return linhas.join("\n");
}

/**
 * Variante que usa toolsets para determinar famílias activas e devolve
 * as descrições das ToolFamily correspondentes (alternativa mais verbosa).
 */
export function gerarCapabilityBlocoDetalhado(
  toolsetsAtivos: HarnessToolsetId[]
): string {
  if (toolsetsAtivos.length === 0) {
    return "Nesta sessão não tens ferramentas adicionais activas.";
  }

  // Colectar prefixos de família a partir dos toolsets
  const prefixosAtivos = new Set<string>(
    toolsetsAtivos.flatMap((id) => {
      const ts = HARNESS_TOOLSETS.find((t) => t.id === id);
      if (!ts) return [];
      // Descobrir as famílias que têm pelo menos uma ferramenta deste toolset
      return TOOL_NAMESPACE_MAP.filter((fam) =>
        ts.ferramentas.some((f) => fam.tools.includes(f))
      ).map((fam) => fam.prefix);
    })
  );

  const familias: ToolFamily[] = TOOL_NAMESPACE_MAP.filter((f) =>
    prefixosAtivos.has(f.prefix)
  );

  const linhas = ["Nesta sessão tens acesso às seguintes capacidades:"];
  for (const fam of familias) {
    linhas.push(`- **${fam.label}**: ${fam.description}`);
  }
  return linhas.join("\n");
}
