/** Cliente pede explicitamente falar com uma pessoa / equipe. */
export function mensagemPedeAtendimentoHumano(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  if (!t || t.length > 400) return false;
  return (
    /\b(falar com|fala com|quero falar|preciso falar)\b.{0,40}\b(humano|pessoa|atendente|consultor|gerente|equipe|algu[eé]m|voc[eê]s)\b/.test(
      t
    ) ||
    /\b(atendimento humano|atendente humano|pessoa real|falar com humano)\b/.test(t) ||
    /\b(chama|chamar|passa|passar|transferir|transfere)\b.{0,32}\b(atendente|humano|consultor|equipe)\b/.test(
      t
    ) ||
    /\b(suporte humano|operador humano)\b/.test(t)
  );
}

const MOTIVOS_ESCALAR_HUMANO = new Set([
  "agente_nao_encontrado",
  "ia_api_key_ausente",
  "escalacao_ia",
  "precisa_aprovacao_humana",
]);

const MSG_ESCALACAO_HUMANO =
  "Recebi sua mensagem e já encaminhei para revisão do time. Retornaremos em breve por aqui.";

const MSG_INSTABILIDADE =
  "Desculpe, tive uma instabilidade agora. Pode repetir em uma frase o que precisa? Estou aqui para ajudar.";

const MSG_AGENDA_RETRY =
  "Não consegui concluir agora. Pode confirmar de novo? (ex.: cancelar a reunião ou escolher um horário.)";

function mensagemSobreAgendaOuCancelamento(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  return (
    /\b(cancel|desmarc|remov)\b/.test(t) ||
    /\b(agenda|agendar|hor[aá]rio|reuni[aã]o|demonstra|demo)\b/.test(t)
  );
}

/** Só envia texto de “equipe vai retornar” quando faz sentido escalar para humanos. */
export function deveEscalarFallbackHumanoAoLead(opts: {
  motivo: string;
  mensagemOriginal: string;
}): boolean {
  if (mensagemPedeAtendimentoHumano(opts.mensagemOriginal)) return true;
  if (MOTIVOS_ESCALAR_HUMANO.has(opts.motivo)) return true;
  return false;
}

/**
 * Mensagem ao lead quando houve falha técnica.
 * `null` = não enviar nada ao cliente (só alerta interno).
 */
export function mensagemFallbackOperacionalAoLead(opts: {
  motivo: string;
  mensagemOriginal: string;
}): string | null {
  if (deveEscalarFallbackHumanoAoLead(opts)) {
    return MSG_ESCALACAO_HUMANO;
  }

  if (opts.motivo.startsWith("playbook_")) {
    return null;
  }

  if (
    mensagemSobreAgendaOuCancelamento(opts.mensagemOriginal) &&
    (opts.motivo === "engine_sem_resposta" || opts.motivo.includes("erro"))
  ) {
    return MSG_AGENDA_RETRY;
  }

  if (opts.motivo === "engine_sem_resposta" || opts.motivo.includes("erro_ia")) {
    return MSG_INSTABILIDADE;
  }

  return null;
}
