import { formatarOpcoesTriagemParaPrompt } from "@/lib/ia/mari-triagem-opcoes";

/** Instruções para Google Calendar / Gmail (function calling hub_int_*). */
export function blocoInstrucoesGoogleWorkspaceAgenda(): string {
  return [
    "═══ GOOGLE CALENDAR + GMAIL (obrigatório para reservas) ═══",
    "A conta Google da empresa está ligada — use as ferramentas, não invente horários.",
    "",
    "1. **hub_int_gcal_listar_eventos** — vagas livres (sem nomes de outros clientes).",
    "2. **hub_int_gcal_criar_evento** — após confirmação; use **hora_cliente** em 24h (20:30 = noite). Cole **link_para_whatsapp** na mensagem.",
    "3. **hub_int_gcal_listar_reservas_lead** — quando perguntar «minhas reservas/agenda»; só deste contacto.",
    "4. **hub_int_gcal_cancelar_evento** — OBRIGATÓRIO ao cancelar; remove no Google Calendar a reserva **deste lead**.",
    "5. **hub_int_gmail_enviar** — opcional como reforço.",
    "",
    "Proibido: confirmar cancelamento sem chamar cancelar_evento; usar 08:30 para 20:30; inventar horários.",
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
    linhas.push(
      "7. **hub_whatsapp_menu** — use **somente quando necessário**: triagem inicial (1ª interação) ou decisão com 2–3 opções fixas.",
      "   **Não** envie menu após cada resposta. Se o cliente já está conversando (link, reunião, dúvida), responda em texto com a base de conhecimento.",
      "   Decisões binárias: tipo `button` (máx. 3). Triagem inicial: tipo `list` (máx. 5), **uma vez** por conversa."
    );
    if (opcoes.playbookUnificado) {
      linhas.push(...formatarOpcoesTriagemParaPrompt().split("\n").map((l) => `   ${l}`));
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

/** Instruções CRM para copiloto interno / superagente (não WhatsApp). */
export function blocoInstrucoesCopilotoInternoCrm(): string {
  return [
    "═══ CRM INTERNO (copiloto / superagente) ═══",
    "Objectivo: responder com dados reais do tenant via hub_int_crm_ent_*.",
    "",
    "Fluxo lead → negócios (obrigatório):",
    "1. **hub_int_crm_ent_lead** — acao=consultar + filtro_texto (nome/telefone) OU acao=obter + id",
    "2. Guarde o **id** (UUID) do lead devolvido no JSON",
    "3. **hub_int_crm_ent_negocio** — acao=consultar + **filtro_lead_id** = UUID do passo 2",
    "4. O mesmo para notas, atividades, conversas, contas: use filtro_lead_id ou filtro_negocio_id",
    "",
    "Proibido:",
    "- Dizer que não há negócios sem chamar hub_int_crm_ent_negocio com filtro_lead_id",
    "- Usar filtro_texto com nome de pessoa em negócio (títulos são códigos, ex. NEG-2026-0001)",
    "- Inventar contagens ou listas sem tool call no mesmo turno",
  ].join("\n");
}
