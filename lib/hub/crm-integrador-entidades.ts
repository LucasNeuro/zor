import type { IntegradorFerramentaDef } from "@/lib/hub/integradores-catalogo";
import { listarEntidadesOperacaoEmpresa } from "@/lib/hub/hub-operacao-empresa";

export const HUB_INT_CRM_ENT_PREFIX = "hub_int_crm_ent_" as const;

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
    filtro_texto: { type: "string" },
    arquivar: { type: "boolean" },
    texto: { type: "string", description: "Texto da nota (acao=nota)" },
  },
  required: ["acao"],
  additionalProperties: false,
};

/** Ferramentas CRM por entidade/tabela — activáveis individualmente por agente interno. */
export function ferramentasCrmPorEntidade(): IntegradorFerramentaDef[] {
  return listarEntidadesOperacaoEmpresa().map((ent) => {
    const caps: string[] = ["consultar", "obter"];
    if (ent.pode_criar) caps.push("criar");
    if (ent.pode_atualizar) caps.push("actualizar");
    if (ent.id === "nota" || ent.id === "atividade") caps.push("nota");

    return {
      ferramenta_key: `${HUB_INT_CRM_ENT_PREFIX}${ent.id}`,
      titulo: ent.label,
      descricao_curta: `${caps.join(", ")} · tabela CRM (${ent.id}).`,
      descricao_modelo: `Opera **${ent.label}** (${ent.id}) no CRM Waje. Acções: ${caps.join(", ")}. Entidade fixa — não passe \`entidade\`. Confirme com o utilizador antes de gravar; só afirme sucesso com ok:true.`,
      politica: ent.pode_criar || ent.pode_atualizar ? "escrita" : "leitura",
      parametros_schema: SCHEMA_OPERAR_ENTIDADE,
    };
  });
}

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

export const CRM_ENTIDADES_TOOL_KEYS = listarEntidadesOperacaoEmpresa().map((e) =>
  crmEntidadeToolKey(e.id)
);
