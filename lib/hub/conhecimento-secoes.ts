/** Secções de `hub_agente_conhecimento` — ordem no playbook e no `system_prompt_base` do wizard. */
export const CONHECIMENTO_SECAO_ORDER = [
  "fluxo_sdr",
  "empresa",
  "servicos",
  "atendimento",
  "proibicoes",
  "objeccoes",
  "exemplos",
] as const;

export type ConhecimentoSecaoId = (typeof CONHECIMENTO_SECAO_ORDER)[number];

export const CONHECIMENTO_TITULO_INSERT: Record<ConhecimentoSecaoId, string> = {
  /** Chave técnica histórica `fluxo_sdr`; texto sempre neutro (qualquer cargo / canal). */
  fluxo_sdr: "Núcleo operacional — objetivo, triagem e fluxo (POP)",
  empresa: "Sobre o negócio",
  servicos: "Serviços",
  atendimento: "Como atender",
  proibicoes: "Nunca fazer",
  objeccoes: "Objeções comuns",
  exemplos: "Exemplos de atendimento",
};

export function isConhecimentoSecaoId(s: string): s is ConhecimentoSecaoId {
  return (CONHECIMENTO_SECAO_ORDER as readonly string[]).includes(s);
}

export function ordemConhecimentoSecao(secao: string): number {
  const i = (CONHECIMENTO_SECAO_ORDER as readonly string[]).indexOf(secao);
  return i === -1 ? 999 : i;
}
