/**
 * Toolsets do harness (RFC §10) — agrupamento lógico de ferramentas.
 */
import { MEM0_BUSCAR_KEY, MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";
import { MISTRAL_PERCEPCAO_KEY } from "@/lib/hub/mistral-integracao-constants";
import {
  HUB_INT_CRM_ATUALIZAR_LEAD,
  HUB_INT_CRM_CONSULTAR,
  HUB_INT_CRM_OPERAR,
  chavesFerramentasBancoCrmWaje,
} from "@/lib/hub/crm-integrador-constants";

export type HarnessToolsetId =
  | "crm_operacoes"
  | "crm_relatorios"
  | "artefatos"
  | "multimodal"
  | "metricas"
  | "memoria"
  | "skills_harness";

export type HarnessToolsetDef = {
  id: HarnessToolsetId;
  titulo: string;
  descricao: string;
  ferramentas: string[];
};

export const HARNESS_TOOLSETS: HarnessToolsetDef[] = [
  {
    id: "crm_operacoes",
    titulo: "CRM — operações",
    descricao: "Consultar e gravar entidades hub_* (leads, negócios, financeiro).",
    ferramentas: [
      HUB_INT_CRM_OPERAR,
      HUB_INT_CRM_ATUALIZAR_LEAD,
      "hub_operacao_empresa",
      ...chavesFerramentasBancoCrmWaje(true),
    ],
  },
  {
    id: "crm_relatorios",
    titulo: "CRM — relatórios",
    descricao: "Views agregadas e dados tabulares para análise.",
    ferramentas: [HUB_INT_CRM_CONSULTAR, "hub_superagente_dados", "hub_dados_empresa"],
  },
  {
    id: "artefatos",
    titulo: "Artefactos canvas",
    descricao: "Dashboards HTML com KPIs, gráficos e link público.",
    ferramentas: ["hub_superagente_artefato"],
  },
  {
    id: "multimodal",
    titulo: "Multimodal Mistral",
    descricao: "OCR, áudio e análise de imagens.",
    ferramentas: [MISTRAL_PERCEPCAO_KEY],
  },
  {
    id: "metricas",
    titulo: "Métricas escritório",
    descricao: "KPIs e indicadores do tenant.",
    ferramentas: ["hub_metricas_escritorio"],
  },
  {
    id: "memoria",
    titulo: "Memória",
    descricao: "Mem0 e memória curada entre sessões.",
    ferramentas: [MEM0_SUPER_MEMORIA_KEY, MEM0_BUSCAR_KEY, "harness_memory"],
  },
  {
    id: "skills_harness",
    titulo: "Skills harness",
    descricao: "Runbooks L1/L2 e orquestração multi-agente.",
    ferramentas: [
      "harness_skills_list",
      "harness_skill_view",
      "harness_skill_manage",
      "harness_session_search",
      "harness_delegate_to_agent",
    ],
  },
];

export function ferramentasDoToolset(toolsetId: HarnessToolsetId): string[] {
  return HARNESS_TOOLSETS.find((t) => t.id === toolsetId)?.ferramentas ?? [];
}

/** Toolsets com pelo menos uma ferramenta activa. */
export function toolsetsActivos(
  uso: Record<string, boolean>
): HarnessToolsetDef[] {
  return HARNESS_TOOLSETS.filter((ts) =>
    ts.ferramentas.some((f) => uso[f] === true)
  );
}

/** Liga/desliga todas as ferramentas de um toolset. */
export function patchUsoFerramentasToolset(
  uso: Record<string, boolean>,
  toolsetId: HarnessToolsetId,
  ativo: boolean
): Record<string, boolean> {
  const next = { ...uso };
  for (const f of ferramentasDoToolset(toolsetId)) {
    next[f] = ativo;
  }
  return next;
}
