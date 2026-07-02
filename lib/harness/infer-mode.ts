import type { HarnessModeId } from "@/lib/harness/types";

const RE_ESCRITA =
  /\b(criar?|cria|registar?|registra|atualizar?|actualizar?|gravar?|grava|adicionar?|inserir?|editar?|alterar?|mudar|mover|apagar?|eliminar?|deletar?|excluir?|confirmo|pode\s+gravar|executa[r]?|salvar?)\b/i;

const RE_PLANEAR =
  /\b(planear?|planej[ae]r?|plano|passo\s+a\s+passo|estrat[eé]gia|roadmap|como\s+fazer|antes\s+de\s+executar|monta[r]?\s+um\s+plano|organiza[r]?\s+(o\s+)?processo)\b/i;

const RE_ANALISAR =
  /\b(listar?|lista|mostrar?|mostra|ver|consultar?|consulta|quais?|quantos?|quantas?|resumo|relat[oó]rio|analis[ae]r?|analisa|dados?|status|est[aá]gio|funil|m[eé]tricas?|buscar?|pesquisar?|filtrar?)\b/i;

const RE_CONVERSAR =
  /\b(como\s+funciona|explica|explique|bom\s+dia|boa\s+tarde|obrigad[oa]|ajuda\s+com|d[uú]vida|significa)\b/i;

function ehModoConversar(msg: string): boolean {
  if (/o\s+que\s+(?:\u00e9|e)\s/i.test(msg)) return true;
  return RE_CONVERSAR.test(msg);
}

/**
 * Infere o modo harness a partir da mensagem actual do utilizador (determinístico).
 * Prioridade: operar > planear > conversar > analisar.
 */
export function inferirHarnessModoDaMensagem(mensagem: string): HarnessModeId {
  const msg = mensagem.trim();
  if (!msg) return "conversar";

  if (RE_ESCRITA.test(msg)) return "operar";
  if (RE_PLANEAR.test(msg)) return "planear";
  if (ehModoConversar(msg)) return "conversar";
  if (RE_ANALISAR.test(msg)) return "analisar";

  return "analisar";
}

export const HARNESS_MODO_LABEL: Record<HarnessModeId, string> = {
  conversar: "Conversar",
  analisar: "Analisar",
  operar: "Operar",
  planear: "Planear",
};
