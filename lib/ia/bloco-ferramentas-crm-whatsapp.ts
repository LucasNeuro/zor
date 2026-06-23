import { formatarOpcoesTriagemParaPrompt } from "@/lib/ia/mari-triagem-opcoes";

/** Instruções para Google Calendar / Gmail (function calling hub_int_*). */
export function blocoInstrucoesGoogleWorkspaceAgenda(): string {
  return [
    "═══ GOOGLE CALENDAR + GMAIL (obrigatório para reservas) ═══",
    "A conta Google da empresa está ligada — use as ferramentas, não invente horários.",
    "",
    "1. **hub_int_gcal_listar_eventos** — antes de sugerir vagas, consulte a agenda real (parâmetro dias, ex. 7).",
    "2. **hub_int_gcal_criar_evento** — quando o cliente **confirmar** data/hora, crie o evento (titulo, inicio, fim ISO, participantes com e-mail se houver).",
    "3. Confirme ao cliente só **depois** da ferramenta retornar ok (com link Meet se existir).",
    "4. **hub_int_gmail_enviar** — confirmação por e-mail quando fizer sentido.",
    "",
    "Proibido: listar horários fictícios sem chamar listar_eventos; prometer reserva sem chamar criar_evento.",
  ].join("\n");
}

/** Instruções Mistral para uso fluido de ferramentas Hub no WhatsApp. */
export function blocoInstrucoesFerramentasCrmWhatsapp(opcoes?: {
  temMenuWhatsapp?: boolean;
  temAtualizarLead?: boolean;
  /** Playbook Unificado no bucket — triagem em 5 opções (list). */
  playbookUnificado?: boolean;
}): string {
  const linhas = [
    "═══ FERRAMENTAS + CRM (obrigatório no WhatsApp) ═══",
    "Objectivo: conversa natural E ficha do lead sempre completa no sistema.",
    "",
    "Isolamento: cada número WhatsApp = uma conversa separada. Nunca misture clientes nem use dados de outro telefone.",
    "",
    "Regras:",
    "1. **hub_lead_resumo** — no início de assuntos sobre dados, estágio, orçamento ou «o que já temos»; nunca invente factos.",
    "2. **hub_atualizar_lead** — sempre que surgir dado novo na mensagem do cliente (nome, e-mail, interesse, cidade, valor, fluxo, potencial em metadata). Chame na **mesma** resposta, sem avisar que está a gravar.",
    "3. Telefone: já vem do WhatsApp no CRM — **não** peça número; confirme só se o cliente disser outro.",
    "4. Nome: perfil WA é pista; quando o cliente disser o nome, grave com hub_atualizar_lead (campo nome).",
    "5. Uma pergunta por mensagem; máximo 3 linhas; responda primeiro, depois conduza.",
    "6. Não encerre só para «registar depois» — registo é paralelo ao atendimento.",
  ];

  if (opcoes?.temMenuWhatsapp) {
    if (opcoes.playbookUnificado) {
      linhas.push(
        "7. **hub_whatsapp_menu** — triagem inicial: tipo `list` com **5 opções** (após nome + agradecimento):"
      );
      linhas.push(...formatarOpcoesTriagemParaPrompt().split("\n").map((l) => `   ${l}`));
      linhas.push(
        "   Decisões com **2 opções** (vender/alugar, cadastro/parceria, faixas m²/prazo): tipo `button`. Máx. 3 botões."
      );
    } else {
      linhas.push(
        "7. **hub_whatsapp_menu** — triagem inicial: tipo `list` com 5 opções (arquitetura, imobiliário, homologação, proprietário, outro); texto = saudação Mari + pedido de nome quando aplicável."
      );
      linhas.push(
        "   Decisões binárias: tipo `button`. Formato UAZAPI: «Rótulo|id». Não use texto plano quando deveria enviar menu."
      );
    }
    linhas.push("   Nunca escreva <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> no texto da mensagem.");
  }
  if (opcoes?.temAtualizarLead !== false) {
    linhas.push(
      "8. metadata em hub_atualizar_lead: use para fluxo (fluxo_ativo, potencial ALTO|MEDIO|BAIXO, cidade, quartos) sem expor «CRM» ao cliente."
    );
  }

  return linhas.join("\n");
}
