/**
 * Triagem Mari — alinhada ao Playbook Unificado (Obra10+), secção 3.
 * Formato UAZAPI: «Rótulo|id» ou listas com descrição «Rótulo|id|descrição».
 */

/** Cabeçalho + 5 ramos (menu tipo `list`). */
export const MARI_TRIAGEM_LISTA_5_UAZAPI = [
  "[O que você precisa]",
  "Arquitetura e projetos|fluxo_arquitetura|Projeto, interiores ou reforma com projeto",
  "Imobiliário (comprar ou alugar)|fluxo1|Compra ou locação de imóvel",
  "Homologação de parceiro|fluxo_homologacao|Fornecedor, corretor ou parceiro Obra10+",
  "Proprietário — anunciar imóvel|fluxo2|Venda ou locação do meu imóvel",
  "Outro assunto|fluxo_outro|Falar com a equipe",
] as const;

/** Linhas para instruções ao modelo (sem cabeçalho de secção). */
export const MARI_TRIAGEM_5_LINHAS_PROMPT = [
  "Arquitetura e projetos|fluxo_arquitetura",
  "Imobiliário (comprar ou alugar)|fluxo1",
  "Homologação de parceiro|fluxo_homologacao",
  "Proprietário — anunciar imóvel|fluxo2",
  "Outro assunto|fluxo_outro",
] as const;

export function formatarOpcoesTriagemParaPrompt(): string {
  return MARI_TRIAGEM_5_LINHAS_PROMPT.map((o) => `- ${o}`).join("\n");
}
