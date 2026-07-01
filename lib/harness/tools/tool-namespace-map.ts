/**
 * Mapeamento de famílias (namespaces) de tools do Harness.
 * Usado para gerar blocos <system_capability> e <tool_use_rules> no prompt.
 */
import type { HarnessModeId } from "@/lib/harness/types";
import {
  CRM_ENTIDADES_TOOL_KEYS,
  HUB_INT_CRM_ATUALIZAR_LEAD,
  HUB_INT_CRM_CONSULTAR,
  HUB_INT_CRM_CRIAR_NEGOCIO,
  HUB_INT_CRM_OPERAR,
  HUB_INT_CRM_REGISTAR_NOTA,
} from "@/lib/hub/crm-integrador-constants";
import { MEM0_BUSCAR_KEY, MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";
import { MISTRAL_PERCEPCAO_KEY } from "@/lib/hub/mistral-integracao-constants";

export type ToolFamily = {
  /** Prefixo/identificador da família (e.g. "crm_ent", "harness"). */
  prefix: string;
  /** Rótulo legível na UI e nos prompts. */
  label: string;
  /** Uma frase descrevendo o que a família faz. */
  description: string;
  /** Nomes exactos das tools que pertencem a esta família. */
  tools: string[];
  /** Modos Harness que activam esta família (undefined = sempre disponível). */
  requiresMode?: HarnessModeId[];
};

export const TOOL_NAMESPACE_MAP: ToolFamily[] = [
  {
    prefix: "crm_ent",
    label: "CRM — Entidades",
    description:
      "Consultar, criar e actualizar entidades operacionais do CRM (leads, negócios, financeiro, notas, actividades, propostas, arquivos, alertas, aprovações).",
    tools: [
      HUB_INT_CRM_OPERAR,
      HUB_INT_CRM_ATUALIZAR_LEAD,
      HUB_INT_CRM_REGISTAR_NOTA,
      HUB_INT_CRM_CRIAR_NEGOCIO,
      "hub_operacao_empresa",
      ...(CRM_ENTIDADES_TOOL_KEYS as readonly string[]),
    ],
    requiresMode: ["analisar", "operar"],
  },
  {
    prefix: "crm_rel",
    label: "CRM — Relatórios",
    description:
      "Views agregadas, relatórios tabulares e dados históricos para análise e tomada de decisão.",
    tools: [HUB_INT_CRM_CONSULTAR, "hub_superagente_dados", "hub_dados_empresa"],
  },
  {
    prefix: "harness",
    label: "Harness — Skills & Memória",
    description:
      "Carregar runbooks (L0/L1), gerir memória curada entre sessões, pesquisar histórico de conversas e delegar tarefas a outros agentes.",
    tools: [
      "harness_skills_list",
      "harness_skill_view",
      "harness_skill_manage",
      "harness_memory",
      "harness_session_search",
      "harness_delegate_to_agent",
      "harness_transfer_lead",
    ],
  },
  {
    prefix: "artefato",
    label: "Artefactos Canvas",
    description:
      "Publicar dashboards HTML interactivos com KPIs, gráficos Chart.js, tabelas de dados e URL pública partilhável.",
    tools: ["hub_superagente_artefato"],
  },
  {
    prefix: "multimodal",
    label: "Multimodal",
    description:
      "OCR em documentos e imagens, transcrição de áudio, análise visual e Q&A em ficheiros multimodais via Mistral.",
    tools: [MISTRAL_PERCEPCAO_KEY],
  },
  {
    prefix: "memoria_ext",
    label: "Memória Semântica (Mem0)",
    description:
      "Recall automático e busca semântica de memórias de longo prazo do agente e do cliente via Mem0.",
    tools: [MEM0_SUPER_MEMORIA_KEY, MEM0_BUSCAR_KEY],
  },
  {
    prefix: "metricas",
    label: "Métricas do Escritório",
    description: "KPIs e indicadores operacionais agregados do tenant (pipeline, conversão, receita).",
    tools: ["hub_metricas_escritorio"],
  },
  {
    prefix: "cliente",
    label: "Dados do Cliente",
    description:
      "Resumo factual, memórias e lookup do lead/cliente activo nesta conversa.",
    tools: [
      "hub_lead_resumo",
      "hub_lead_memorias",
      "hub_lead_lookup_por_telefone",
    ],
  },
];

/** Devolve a família cujo prefixo corresponde ao fornecido, ou undefined. */
export function toolFamilyByPrefix(prefix: string): ToolFamily | undefined {
  return TOOL_NAMESPACE_MAP.find((f) => f.prefix === prefix);
}

/** Devolve a família à qual a tool pertence, ou undefined. */
export function toolFamilyForTool(toolName: string): ToolFamily | undefined {
  return TOOL_NAMESPACE_MAP.find((f) => f.tools.includes(toolName));
}

/** Todas as tools registadas no mapa, sem duplicados. */
export function allMappedTools(): string[] {
  const seen = new Set<string>();
  for (const family of TOOL_NAMESPACE_MAP) {
    for (const t of family.tools) seen.add(t);
  }
  return [...seen];
}
