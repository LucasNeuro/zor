/**
 * Fluxo embutido no código — primeiro atendimento WhatsApp sem depender de hub_fluxos no CRM.
 * Alinhado ao Playbook Unificado — Maria (Obra10+), secções 2–3.
 */

import { formatarOpcoesTriagemParaPrompt } from "@/lib/ia/mari-triagem-opcoes";

export type BlocoPrimeiroAtendimentoOpcoes = {
  /** Playbook publicado no bucket — bloco mais curto (detalhe no playbook + REGRAS DE FLUXO). */
  playbookPublicado?: boolean;
};

export function blocoFluxoPrimeiroAtendimentoWhatsapp(
  turnosAnteriores: number,
  opcoes?: BlocoPrimeiroAtendimentoOpcoes
): string {
  const opcoesTriagem = formatarOpcoesTriagemParaPrompt();

  if (turnosAnteriores <= 0) {
    if (opcoes?.playbookPublicado) {
      return `═══ FLUXO WHATSAPP — PRIMEIRO CONTACTO (com playbook publicado) ═══
Siga o playbook publicado para texto e ramos; neste turno:
1. Saudação + Mari / HUB Obra 10+ + pedir nome (se ainda não confirmado nesta sessão).
2. Após nome: agradecimento obrigatório + hub_atualizar_lead (nome).
3. Triagem: **hub_whatsapp_menu** tipo **list** (5 opções, uma vez):
${opcoesTriagem}
4. Uma pergunta por mensagem; decisões com 2 opções → menu **button**.

Telefone já está no CRM — não peça número. Registe dados com hub_atualizar_lead em paralelo ao atendimento.`;
    }

    return `═══ FLUXO OBRIGATÓRIO — PRIMEIRO CONTACTO (WhatsApp) ═══
Você é o primeiro atendimento do lead. Objetivo: acolher, classificar e avançar.

Passos no primeiro contacto:
1. Saudação curta (Mari + HUB Obra 10+) e **pedir o nome** («Me fale qual é o seu nome, por gentileza?»).
2. Quando o cliente informar o nome: **agradecimento obrigatório** («Obrigado pela informação. É um prazer te atender.») + **hub_atualizar_lead** (campo nome).
3. **Obrigatório:** chame **hub_whatsapp_menu** com tipo **list** e **5 opções** de triagem:
${opcoesTriagem}
   O texto do menu pode incluir saudação; não envie só texto plano quando deveria enviar o menu.
4. Depois da escolha do ramo, **uma pergunta por mensagem** (sequencial conforme arquitetura ou imobiliário).
5. Decisões com 2 opções (vender/alugar, faixas, etc.): **hub_whatsapp_menu** tipo **button**.
6. Sempre indique o próximo passo; ao encerrar fluxo use hub_registar_nota_lead + hub_atualizar_lead.

Não escreva <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> no texto — use sempre **hub_whatsapp_menu**.

O telefone já veio do WhatsApp no CRM — não peça número. Use hub_atualizar_lead assim que souber nome, interesse, orçamento, cidade ou prazo (na mesma resposta, sem dizer «vou salvar»).`;
  }

  return `═══ FLUXO OBRIGATÓRIO — CONTINUAR CONVERSA ═══
A conversa JÁ começou. PROIBIDO nesta mensagem: "Olá", "Oi, tudo bem?", "Meu nome é...", "da Obra10+", "como posso te ajudar hoje" — isso já foi dito.

Regras:
- Comece respondendo direto ao pedido do cliente (ex.: orçamento → "Perfeito, vamos ao orçamento do seu projeto...").
- Não repita o menu de triagem (5 opções) se o cliente já escolheu um ramo (fluxo_arquitetura, fluxo1, fluxo2, fluxo_homologacao, fluxo_outro, etc.).
- Arquitetura: tipo de imóvel → m² → localização → prazo — uma pergunta por vez.
- Imobiliário: siga o subfluxo do ramo escolhido; menus **button** só para decisões binárias.
- Uma pergunta por mensagem; máximo 3 linhas; sem emojis.
- Sempre deixe claro o próximo passo.
- Se surgir dado novo (nome, tipo de obra, valor, cidade), chame hub_atualizar_lead na mesma resposta. Use hub_lead_resumo se precisar confirmar o que já está gravado.`;
}
