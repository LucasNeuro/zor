/**
 * Resolve o que injectar antes do turno Harness:
 * - Modo "planear" → gera steps de Plan heurísticos a partir da mensagem + tools activas
 * - Skills L0 cujo skill_id ou titulo coincidem com palavras da mensagem → Knowledge events
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HarnessHostContext, HarnessModeId } from "@/lib/harness/types";
import type { AgenteSkillRow } from "@/lib/harness/stores/skills-store";

/** Alias público para compatibilidade com a nomenclatura do RFC. */
export type SkillL0Row = AgenteSkillRow;

export type PlanKnowledgeResult = {
  planSteps: string[];
  knowledgeEvents: Array<{ skill_id: string; resumo: string }>;
};

/**
 * Gera 3–5 steps heurísticos para o modo "planear" a partir da mensagem do utilizador.
 * Determinístico — não chama LLM.
 */
function gerarPlanSteps(mensagemUsuario: string): string[] {
  const msg = mensagemUsuario.trim().toLowerCase();

  // Padrões comuns de CRM — escolher template adequado.
  const ehConsulta =
    /\b(listar?|mostrar?|ver|consultar?|quais?|quantos?|resumo|relatório|relatório|analisa[r]?|dados?)\b/.test(msg);
  const ehEscrita =
    /\b(criar?|registar?|atualizar?|actualizar?|gravar?|adicionar?|inserir?|editar?|eliminar?)\b/.test(msg);
  const ehAnalise =
    /\b(analis[ae]r?|compar[ae]r?|tendência|padrão|insight|evolu[çc][aã]o)\b/.test(msg);

  if (ehEscrita) {
    return [
      "Identificar o registo alvo no CRM",
      "Validar os dados fornecidos",
      "Executar a operação de escrita via ferramenta CRM",
      "Confirmar ok:true e resumir o resultado ao utilizador",
    ];
  }

  if (ehAnalise) {
    return [
      "Consultar os dados relevantes via ferramentas CRM",
      "Agregar e filtrar resultados por critério",
      "Identificar padrões ou tendências nos dados",
      "Formular resposta analítica com base nas Observations",
    ];
  }

  if (ehConsulta) {
    return [
      "Determinar a ferramenta CRM adequada à consulta",
      "Executar a consulta com os filtros necessários",
      "Resumir os resultados de forma clara ao utilizador",
    ];
  }

  // Genérico para modo planear sem padrão específico.
  return [
    "Compreender o pedido e identificar as ferramentas necessárias",
    "Executar as acções requeridas via ferramentas CRM",
    "Validar os resultados obtidos",
    "Apresentar a resposta final ao utilizador",
  ];
}

/**
 * Verifica se uma skill é relevante para a mensagem do utilizador.
 * Usa correspondência simples de palavras-chave (não RAG).
 */
function skillRelevanteParaMensagem(skill: AgenteSkillRow, mensagem: string): boolean {
  const haystack = mensagem.toLowerCase();
  const skillIdNorm = skill.skill_id.toLowerCase().replace(/_/g, " ");
  const tituloNorm = skill.titulo.toLowerCase();

  // Fragmentos do skill_id ou palavras do titulo com ≥4 chars.
  const tokens = [
    ...skillIdNorm.split(/[\s_-]+/),
    ...tituloNorm.split(/\s+/),
  ].filter((t) => t.length >= 4);

  return tokens.some((token) => haystack.includes(token));
}

/**
 * Resolve Plan e Knowledge a injectar antes do turno.
 *
 * @param supabase  Cliente Supabase (não usado ainda — reservado para L1 fetch futuro)
 * @param ctx       Contexto do host (modoId usado para Plan)
 * @param mensagemUsuario  Mensagem actual do utilizador
 * @param modoId    Modo de sessão activo
 * @param skillsL0  Skills já carregadas pelo host
 */
export async function resolverPlanKnowledge(
  _supabase: SupabaseClient,
  ctx: HarnessHostContext,
  mensagemUsuario: string,
  modoId: HarnessModeId,
  skillsL0: AgenteSkillRow[]
): Promise<PlanKnowledgeResult> {
  const planSteps: string[] =
    (modoId === "planear" || ctx.modoId === "planear")
      ? gerarPlanSteps(mensagemUsuario)
      : [];

  const knowledgeEvents: Array<{ skill_id: string; resumo: string }> = skillsL0
    .filter((s) => skillRelevanteParaMensagem(s, mensagemUsuario))
    .slice(0, 3) // máximo 3 knowledge events por turno
    .map((s) => ({
      skill_id: s.skill_id,
      resumo: s.descricao?.trim() || s.titulo,
    }));

  return { planSteps, knowledgeEvents };
}
