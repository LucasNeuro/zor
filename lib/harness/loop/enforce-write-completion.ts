export type ToolCallExecLog = {
  nome: string;
  ok: boolean;
  resultadoPreview: string;
};

const PROMESSA_ESCRITA_RE =
  /\b(vou criar|vou atualizar|vou actualizar|vou registar|vou gravar|um momento|aguarde|em instantes)\b/i;

const WRITE_TOOL_PREFIXES = [
  "hub_int_crm_ent_",
  "hub_int_crm_atualizar_lead",
  "hub_int_crm_registar_nota",
  "hub_operacao_empresa",
] as const;

export function ferramentaEscritaHub(nome: string): boolean {
  return WRITE_TOOL_PREFIXES.some((p) => nome === p || nome.startsWith(p));
}

export function respostaPrometeEscritaPendente(texto: string): boolean {
  return PROMESSA_ESCRITA_RE.test(texto);
}

export function houveToolEscritaComSucesso(tools: ToolCallExecLog[]): boolean {
  return tools.some((t) => ferramentaEscritaHub(t.nome) && t.ok);
}

/** Re-tenta o turno quando o modelo prometeu gravar mas não executou tool de escrita. */
export function deveReforcarLoopEscrita(textoResposta: string, tools: ToolCallExecLog[]): boolean {
  if (!respostaPrometeEscritaPendente(textoResposta)) return false;
  return !houveToolEscritaComSucesso(tools);
}

export const NUDGE_ESCRITA_HARNESS =
  "ERRO DO TURNO ANTERIOR: prometeu gravar no CRM mas não chamou ferramenta de escrita ou não obteve ok:true. " +
  "Chame AGORA hub_int_crm_ent_{entidade} com acao=criar ou atualizar (ou hub_int_crm_atualizar_lead). " +
  "Só responda ao utilizador depois de ok:true no JSON da ferramenta. Proibido «um momento» sem tool.";
