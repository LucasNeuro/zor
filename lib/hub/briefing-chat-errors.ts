import { mensagemUsuario } from "@/lib/crm/mensagens-usuario";

/** Mensagens de erro do Copiloto IA / briefing — sem jargão de schema ou infra. */
export function mensagemErroBriefingChat(raw: string): string {
  const m = raw.trim();
  if (!m) return "Não foi possível enviar a mensagem.";

  if (
    /hub_crm_agente_briefing_sessao|hub_crm_agente_briefing_mensagem/i.test(m) ||
    (/schema cache/i.test(m) && /could not find the table/i.test(m))
  ) {
    return "O chat de teste ainda não está activo neste ambiente. Contacte o suporte da plataforma.";
  }

  return mensagemUsuario(m);
}
