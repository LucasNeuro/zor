/**
 * Fluxo embutido no código — primeiro atendimento WhatsApp sem depender de hub_fluxos no CRM.
 * Modo Waje: conversa livre com base de conhecimento; menus só quando necessário.
 */

export type BlocoPrimeiroAtendimentoOpcoes = {
  /** Playbook publicado no bucket — detalhe no playbook + roteiro híbrido. */
  playbookPublicado?: boolean;
};

export function blocoFluxoPrimeiroAtendimentoWhatsapp(
  turnosAnteriores: number,
  opcoes?: BlocoPrimeiroAtendimentoOpcoes
): string {
  if (turnosAnteriores <= 0) {
    if (opcoes?.playbookPublicado) {
      return `═══ FLUXO WHATSAPP — PRIMEIRO CONTACTO (com playbook publicado) ═══
Siga o playbook e a **base de conhecimento** como fonte principal.
1. Saudação curta + seu nome + empresa; peça o nome se ainda não souber (CRM/histórico).
2. Após nome: agradeça e grave com hub_atualizar_lead.
3. **Menu/lista:** só se fizer sentido para triagem inicial — **uma vez**; use hub_whatsapp_menu se estiver activo.
4. Responda primeiro ao que o cliente perguntou; uma pergunta por mensagem.

Telefone já está no CRM — não peça número.`;
    }

    return `═══ FLUXO — PRIMEIRO CONTACTO (WhatsApp) ═══
Objetivo: acolher com naturalidade usando a **base de conhecimento** e o Mistral.

1. Saudação curta + seu nome + empresa; peça o nome se necessário.
2. Grave dados com hub_atualizar_lead assim que souber (nome, interesse, etc.).
3. **Não** envie menu de triagem por defeito — só se o cliente pedir opções ou o playbook exigir triagem inicial.
4. Uma pergunta por mensagem; máximo 3 linhas.

Não escreva <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> — use hub_whatsapp_menu apenas quando precisar de botões/lista.`;
  }

  return `═══ FLUXO — CONTINUAR CONVERSA ═══
A conversa JÁ começou. PROIBIDO: repetir saudação completa, reapresentar a empresa ou reenviar menu de triagem.

Regras:
- Responda **directamente** ao pedido (link, reunião, preço, dúvida) com a base de conhecimento.
- **Não** repita menu de opções salvo se o cliente pedir «menu» ou «opções».
- Uma pergunta por mensagem; máximo 3 linhas.
- Dados novos → hub_atualizar_lead na mesma resposta.
- hub_whatsapp_menu: **somente** decisões binárias (2–3 botões) quando realmente precisar — não após cada mensagem.`;
}
