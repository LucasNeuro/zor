/** Mensagens para utilizadores — sem nomes de variáveis, tabelas ou infraestrutura. */
export function mensagemUsuario(raw: string): string {
  const m = raw.trim();
  if (!m) return "Ocorreu um erro. Tente novamente.";

  if (/MEM0_API_KEY|mem0\.ai/i.test(m)) {
    return "Super Memória indisponível neste ambiente. Contacte o suporte da plataforma.";
  }

  if (/MISTRAL_API_KEY|ANTHROPIC_API_KEY|mistral\.ai|anthropic/i.test(m)) {
    return "Serviço de IA indisponível. Contacte o suporte da plataforma.";
  }

  if (/UAZAPI_|uazapi/i.test(m)) {
    if (/não configurado|not configured|token/i.test(m)) {
      return "WhatsApp não está configurado. Reconecte o canal em Agentes → Canais.";
    }
    return "Não foi possível enviar pelo WhatsApp. Verifique a ligação do canal.";
  }

  if (/GOOGLE_OAUTH|MICROSOFT_OAUTH|HUB_CREDENTIALS|WINDSOR_API/i.test(m)) {
    return "Integração ainda não disponível neste ambiente. Contacte o suporte da plataforma.";
  }

  if (/NEXT_PUBLIC_|SUPABASE_|\.env|Render\b/i.test(m)) {
    return "Serviço temporariamente indisponível. Tente novamente ou contacte o suporte.";
  }

  if (
    /hub_[a-z0-9_]+/i.test(m) &&
    (/could not find|schema cache|tabela|table|execute/i.test(m) || /\.sql/i.test(m))
  ) {
    return "Funcionalidade ainda não activa neste ambiente. Contacte o suporte da plataforma.";
  }

  return m;
}
