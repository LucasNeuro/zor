import { nomeLeadEhPlaceholder } from "@/lib/crm/sincronizar-contato-whatsapp";

const NOME_PATTERNS = [
  /(?:me chamo|meu nome é|meu nome e|sou o|sou a|aqui é|pode me chamar de|sou)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,48})/i,
];

function mensagemPareceNomeCurto(mensagem: string): boolean {
  const t = mensagem.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.includes("@")) return false;
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|obrigado|obrigada)\s*!?\.?$/i.test(t)) {
    return false;
  }
  if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]*$/.test(t)) return false;
  return !nomeLeadEhPlaceholder(t);
}

/**
 * Extrai nome de mensagens ricas («Sou Lucas…») ou resposta curta («Marcelo»)
 * quando o agente acabou de pedir o nome.
 */
export function extrairNomeClienteDaMensagem(
  mensagem: string,
  opts?: { respostaCurtaPermitida?: boolean }
): string | undefined {
  const trimmed = mensagem.trim();
  if (!trimmed) return undefined;

  for (const pattern of NOME_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match?.[1]) continue;
    const candidato = match[1]
      .trim()
      .split(/[,.\n!?]/)[0]!
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    if (mensagemPareceNomeCurto(candidato)) return candidato.slice(0, 240);
  }

  if (opts?.respostaCurtaPermitida !== false && mensagemPareceNomeCurto(trimmed)) {
    return trimmed.slice(0, 240);
  }

  return undefined;
}

/** Heurística: mensagem do agente pediu nome recentemente. */
export function agentePerguntouNome(respostaAgente?: string | null): boolean {
  const t = String(respostaAgente ?? "").toLowerCase();
  if (!t.trim()) return false;
  return /\b(seu|teu)\s+nome\b/.test(t) || /\bqual\s+[ée]\s+(o\s+)?seu\s+nome\b/.test(t) || /\bme\s+(diz|diga|fala)\s+(o\s+)?(seu\s+)?nome\b/.test(t);
}
