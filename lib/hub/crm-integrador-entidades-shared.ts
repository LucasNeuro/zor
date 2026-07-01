/**
 * Constantes CRM por entidade — seguras para componentes client.
 * Sincronizado com lib/hub/hub-operacao-entidades-operacionais.ts
 */

import {
  OPERACAO_ENTIDADE_CATALOGO,
  OPERACAO_ENTIDADES_TOOL_KEYS,
  type OperacaoEntidadeSlug,
} from "@/lib/hub/hub-operacao-entidades-operacionais";

export const HUB_INT_CRM_ENT_PREFIX = "hub_int_crm_ent_" as const;

export const CRM_ENTIDADES_CATALOGO = OPERACAO_ENTIDADE_CATALOGO;

export const CRM_ENTIDADES_SLUGS = CRM_ENTIDADES_CATALOGO.map((e) => e.id);

export type CrmEntidadeSlug = OperacaoEntidadeSlug;

export function crmEntidadeToolKey(entidade: string): string {
  return `${HUB_INT_CRM_ENT_PREFIX}${entidade}`;
}

export function parseCrmEntidadeToolKey(key: string): string | null {
  if (!key.startsWith(HUB_INT_CRM_ENT_PREFIX)) return null;
  const slug = key.slice(HUB_INT_CRM_ENT_PREFIX.length).trim();
  return slug || null;
}

export function isCrmEntidadeToolKey(key: string): boolean {
  return parseCrmEntidadeToolKey(key) !== null;
}

export const CRM_ENTIDADES_TOOL_KEYS = OPERACAO_ENTIDADES_TOOL_KEYS;

const SCHEMA_OPERAR_ENTIDADE = {
  type: "object",
  properties: {
    acao: {
      type: "string",
      enum: ["consultar", "obter", "criar", "atualizar", "nota"],
      description: "consultar lista; obter por id; criar/atualizar registo; nota regista timeline",
    },
    id: { type: "string", description: "UUID — obrigatório em obter e atualizar" },
    dados: { type: "object", additionalProperties: true },
    view: { type: "string" },
    colunas: { type: "array", items: { type: "string" } },
    limite: { type: "integer", minimum: 1, maximum: 50 },
    filtro_coluna: { type: "string" },
    filtro_texto: {
      type: "string",
      description: "Busca textual em nome/título/email — use em lead/pessoa. NÃO use nome de pessoa para filtrar negócio.",
    },
    filtro_lead_id: {
      type: "string",
      description: "UUID do lead — obrigatório para listar negócios/notas/atividades/conversas desse lead (acao=consultar).",
    },
    filtro_negocio_id: {
      type: "string",
      description: "UUID do negócio — listar notas, atividades, contas a receber, propostas ligadas ao negócio.",
    },
    filtro_pessoa_id: {
      type: "string",
      description: "UUID da pessoa — quando a entidade tem pessoa_id.",
    },
    arquivar: { type: "boolean" },
    texto: { type: "string", description: "Texto da nota (acao=nota)" },
  },
  required: ["acao"],
  additionalProperties: false,
};

const DICA_CONSULTA_POR_ENTIDADE: Partial<Record<OperacaoEntidadeSlug, string>> = {
  lead: "Buscar por nome/telefone: acao=consultar + filtro_texto. Depois guarde o id (UUID).",
  negocio:
    "Negócios de um lead: acao=consultar + filtro_lead_id=<UUID do lead>. Títulos (NEG-2026-…) não contêm o nome — nunca use só filtro_texto com nome de pessoa.",
  nota: "Notas do lead: filtro_lead_id. Do negócio: filtro_negocio_id.",
  atividade: "Timeline do lead: filtro_lead_id. Do negócio: filtro_negocio_id.",
  conta_receber: "Por lead: filtro_lead_id. Por negócio: filtro_negocio_id.",
  conversa: "Conversas do lead: filtro_lead_id.",
  proposta: "Por lead: filtro_lead_id. Por negócio: filtro_negocio_id.",
  memoria_lead: "Memórias do lead: filtro_lead_id.",
  arquivo: "Anexos do lead: filtro_lead_id.",
  alerta: "Alertas do lead: filtro_lead_id.",
  aprovacao: "Aprovações do lead: filtro_lead_id.",
};

export type CrmIntegradorFerramentaDef = {
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string;
  descricao_modelo: string;
  politica: "leitura" | "escrita";
  parametros_schema: Record<string, unknown>;
};

/** Ferramentas CRM por entidade — catálogo estático. */
export function ferramentasCrmPorEntidade(): CrmIntegradorFerramentaDef[] {
  return CRM_ENTIDADES_CATALOGO.map((ent) => {
    const caps: string[] = ["consultar", "obter"];
    if (ent.pode_criar) caps.push("criar");
    if (ent.pode_atualizar) caps.push("actualizar");
    if (ent.id === "nota" || ent.id === "atividade") caps.push("nota");

    const dica = DICA_CONSULTA_POR_ENTIDADE[ent.id];
    const dicaTxt = dica ? ` ${dica}` : "";

    return {
      ferramenta_key: crmEntidadeToolKey(ent.id),
      titulo: ent.label,
      descricao_curta: `${caps.join(", ")} · tabela operacional (${ent.id}).`,
      descricao_modelo: `Opera **${ent.label}** (${ent.id}) na tabela do tenant. Acções: ${caps.join(", ")}.${dicaTxt} **Obrigatório:** para criar/actualizar chame esta ferramenta no mesmo turno; só confirme sucesso com ok:true no JSON; nunca diga «um momento» sem ter chamado a ferramenta.`,
      politica: ent.pode_criar || ent.pode_atualizar ? "escrita" : "leitura",
      parametros_schema: SCHEMA_OPERAR_ENTIDADE,
    };
  });
}
