/**
 * Constantes CRM por entidade — seguras para componentes client.
 * Manter sincronizado com OperacaoEmpresaEntidade em hub-operacao-empresa.ts.
 */

export const HUB_INT_CRM_ENT_PREFIX = "hub_int_crm_ent_" as const;

export const CRM_ENTIDADES_CATALOGO = [
  { id: "lead", label: "Lead CRM", pode_criar: true, pode_atualizar: true },
  { id: "negocio", label: "Negócio", pode_criar: true, pode_atualizar: true },
  { id: "pessoa", label: "Pessoa", pode_criar: true, pode_atualizar: true },
  { id: "empresa", label: "Empresa", pode_criar: true, pode_atualizar: true },
  { id: "nota", label: "Nota CRM", pode_criar: true, pode_atualizar: false },
  { id: "conta_receber", label: "Conta a receber", pode_criar: true, pode_atualizar: true },
  { id: "conta_pagar", label: "Conta a pagar", pode_criar: true, pode_atualizar: true },
  { id: "atividade", label: "Atividade / timeline", pode_criar: true, pode_atualizar: false },
  { id: "aprovacao", label: "Aprovação", pode_criar: false, pode_atualizar: true },
  { id: "alerta", label: "Alerta operação", pode_criar: false, pode_atualizar: true },
  { id: "conversa", label: "Conversa", pode_criar: false, pode_atualizar: true },
  { id: "servico_catalogo", label: "Catálogo de serviços", pode_criar: true, pode_atualizar: true },
  { id: "parceiro", label: "Parceiro", pode_criar: false, pode_atualizar: true },
  { id: "servico", label: "Serviço catálogo", pode_criar: true, pode_atualizar: true },
  { id: "proposta", label: "Proposta", pode_criar: true, pode_atualizar: true },
  { id: "kpi_meta", label: "Meta KPI", pode_criar: true, pode_atualizar: true },
  { id: "kpi_resultado", label: "Resultado KPI", pode_criar: true, pode_atualizar: true },
] as const;

export const CRM_ENTIDADES_SLUGS = CRM_ENTIDADES_CATALOGO.map((e) => e.id);

export type CrmEntidadeSlug = (typeof CRM_ENTIDADES_CATALOGO)[number]["id"];

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

export const CRM_ENTIDADES_TOOL_KEYS = CRM_ENTIDADES_SLUGS.map((id) => crmEntidadeToolKey(id));

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

export type CrmIntegradorFerramentaDef = {
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string;
  descricao_modelo: string;
  politica: "leitura" | "escrita";
  parametros_schema: Record<string, unknown>;
};

/** Ferramentas CRM por entidade — catálogo estático (sem importar hub-operacao-empresa). */
export function ferramentasCrmPorEntidade(): CrmIntegradorFerramentaDef[] {
  return CRM_ENTIDADES_CATALOGO.map((ent) => {
    const caps: string[] = ["consultar", "obter"];
    if (ent.pode_criar) caps.push("criar");
    if (ent.pode_atualizar) caps.push("actualizar");
    if (ent.id === "nota" || ent.id === "atividade") caps.push("nota");

    return {
      ferramenta_key: crmEntidadeToolKey(ent.id),
      titulo: ent.label,
      descricao_curta: `${caps.join(", ")} · tabela CRM (${ent.id}).`,
      descricao_modelo: `Opera **${ent.label}** (${ent.id}) na tabela CRM **${ent.id}**. Acções: ${caps.join(", ")}. consultar=lista registos na tabela (filtro_texto opcional); obter/criar/actualizar usam hub_* directamente. Não passe \`entidade\`. Confirme com o utilizador antes de gravar; só afirme sucesso com ok:true.`,
      politica: ent.pode_criar || ent.pode_atualizar ? "escrita" : "leitura",
      parametros_schema: SCHEMA_OPERAR_ENTIDADE,
    };
  });
}
