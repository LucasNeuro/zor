/** Mensagens amigáveis para operações de agente (salvar, arquivar, briefing). */
export function mensagemErroHubAgente(raw: string): string {
  const m = raw.trim();
  if (!m) return "Não foi possível concluir a operação.";

  if (
    /arquivado_em|arquivado_motivo/i.test(m) &&
    (/does not exist/i.test(m) || /schema cache/i.test(m) || /could not find/i.test(m))
  ) {
    return "Arquivamento ainda não está activo neste ambiente. No Supabase → SQL Editor, execute supabase/scripts/ensure_hub_agente_arquivado_em.sql e recarregue.";
  }

  if (
    /hub_crm_agente_briefing_sessao|hub_crm_agente_briefing_mensagem/i.test(m) ||
    (/schema cache/i.test(m) && /could not find the table/i.test(m))
  ) {
    return "O chat de teste ainda não está activo. Execute supabase/scripts/ensure_hub_briefing_chat_tables.sql no Supabase e recarregue.";
  }

  return m;
}
