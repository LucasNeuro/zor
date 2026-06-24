/**
 * Blocos de prompt runtime com playbook publicado no bucket.
 * Legado Mari/Obra10 mantido só para agentes `agenteUsaPlaybookLegadoMari`.
 */

export function blocoRegrasFluxoSequencialPlaybook(flowHintsFromMd?: string | null): string {
  const linhas = [
    `═══ REGRAS DE FLUXO (playbook publicado) ═══`,
    "",
    "## Conversa livre (prioridade)",
    "- Base de conhecimento + Mistral conduzem o atendimento; o roteiro é **guia**, não script.",
    "- Responda primeiro ao que o cliente pediu; não repita menu nem saudação.",
    "- hub_whatsapp_menu: **somente** triagem inicial (1×) ou decisão binária — nunca após cada resposta.",
    "- Uma pergunta por mensagem; máximo 3 linhas.",
    "- hub_atualizar_lead em paralelo quando surgirem dados novos.",
    "- Nunca escreva <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> — use hub_whatsapp_menu quando necessário.",
  ];

  if (flowHintsFromMd?.trim()) {
    linhas.push(
      "",
      "## Resumo do playbook publicado",
      flowHintsFromMd.trim()
    );
  }

  return linhas.join("\n");
}
