/**
 * Blocos de prompt runtime para Mari com playbook publicado no bucket.
 * Espelha Playbook Unificado — Maria (Obra10+): secções 2–5 e 9.
 *
 * Fluxo determinístico no inbound (`inbound-message-processor` + `menu-triagem-uazapi`)
 * pode antecipar menus; este bloco orienta o modelo quando a IA conduz o turno.
 */

import { formatarOpcoesTriagemParaPrompt } from "@/lib/ia/mari-triagem-opcoes";

export function blocoRegrasFluxoSequencialPlaybook(flowHintsFromMd?: string | null): string {
  const opcoes = formatarOpcoesTriagemParaPrompt();
  const linhas = [
    `═══ REGRAS DE FLUXO SEQUENCIAL (playbook §2–§5, §9) ═══`,
    "",
    "## §2 — Comum (todas as conversas)",
    "- 1ª mensagem: saudação curta + apresentação (Mari / HUB Obra 10+) + pedir nome («Me fale qual é o seu nome, por gentileza?»).",
    "- Após o cliente informar o nome: agradecimento obrigatório («Obrigado pela informação. É um prazer te atender.») e hub_atualizar_lead com campo nome na mesma resposta.",
    "- Uma pergunta por mensagem; não avance etapas sem resposta do cliente.",
    "",
    "## §3 — Triagem (uma vez por conversa)",
    "- Depois do nome (ou se o nome já estiver no CRM nesta sessão), envie **hub_whatsapp_menu** tipo **list** com as 5 opções:",
    ...opcoes.split("\n"),
    "- Não repita o menu de triagem depois que o cliente escolher um ramo (fluxo_arquitetura, fluxo1, fluxo2, fluxo_homologacao, fluxo_outro ou equivalente).",
    "- Para decisões binárias (ex.: vender/alugar, cadastro/parceria, faixas de m² ou prazo): **hub_whatsapp_menu** tipo **button** com 2 opções.",
    "",
    "## §4 — Arquitetura (fluxo_arquitetura)",
    "- Sequencial, nesta ordem, uma pergunta por mensagem: tipo de imóvel → tamanho aproximado (m²) → localização (cidade/bairro) → prazo para iniciar.",
    "- Prefira menus button/list para faixas de m² e prazo quando o playbook indicar.",
    "",
    "## §5 — Imobiliário",
    "- Após triagem imobiliária: subclassifique (cliente final compra/locação, proprietário, corretor/imobiliária) e siga o ramo do playbook (fluxo1 / fluxo2 / fluxo3).",
    "- Não misture perguntas de ramos diferentes na mesma mensagem.",
    "",
    "## §9 — Regras gerais",
    "- Máximo 3 linhas por mensagem; sem emojis.",
    "- Responda primeiro à pergunta do cliente; depois conduza.",
    "- Não salte etapas do playbook; não repita perguntas já respondidas no histórico.",
    "- Ao encerrar um fluxo: card/resumo via hub_registar_nota_lead + hub_atualizar_lead (metadata: fluxo_ativo, potencial, lead_kind).",
    "- Nunca escreva <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> — use hub_whatsapp_menu.",
  ];

  if (flowHintsFromMd?.trim()) {
    linhas.push(
      "",
      "## Resumo das secções do playbook publicado",
      flowHintsFromMd.trim()
    );
  }

  return linhas.join("\n");
}
