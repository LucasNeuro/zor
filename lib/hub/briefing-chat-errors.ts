/** Mensagens de erro do Copiloto IA / briefing — sem jargão de schema Supabase. */
export function mensagemErroBriefingChat(raw: string): string {
  const m = raw.trim();
  if (!m) return "Não foi possível enviar a mensagem.";

  if (
    /hub_crm_agente_briefing_sessao|hub_crm_agente_briefing_mensagem/i.test(m) ||
    (/schema cache/i.test(m) && /could not find the table/i.test(m))
  ) {
    return "O chat de teste ainda não está activo neste ambiente. No Supabase → SQL Editor, execute o ficheiro supabase/scripts/ensure_hub_briefing_chat_tables.sql e recarregue a página.";
  }

  if (/MISTRAL_API_KEY|ANTHROPIC_API_KEY|provedor IA/i.test(m)) {
    return "Serviço de IA indisponível. Verifique as chaves de API no servidor.";
  }

  return m;
}
