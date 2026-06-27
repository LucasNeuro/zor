/** Heurísticas partilhadas — nome real vs frase de conversa ou placeholder CRM. */

const FRASE_CONVERSA_NAO_NOME =
  /\b(está|esta|estao|estão|aí|ai|ta|tudo|bem|agenda|perguntei|pergunta|desmarque|desmarcar|entender|sistema|automa|whatsapp|voce|você|vc|obrigad|desculp|pode|quero|preciso|sobre|minha|meu|tenho|hoje|amanhã|amanha|como|oi|olá|ola)\b/i;

function normalizarNomeTexto(nome: string): string {
  return nome.normalize("NFC").trim();
}

export function nomeCandidatoEhValido(nome: string | null | undefined): boolean {
  const t = normalizarNomeTexto(String(nome ?? ""));
  if (!t || t.length < 2) return false;
  if (FRASE_CONVERSA_NAO_NOME.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if (words.length >= 2 && /^oi[\s,!?.]/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.includes("@")) return false;
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|obrigado|obrigada)\s*!?\.?$/i.test(t)) {
    return false;
  }
  return true;
}

export function nomeLeadEhPlaceholder(nome: string | null | undefined): boolean {
  const n = normalizarNomeTexto(String(nome ?? ""));
  if (!n || n.length < 2) return true;
  const lower = n.toLowerCase();
  if (lower.startsWith("lead ")) return true;
  if (lower === "lead whatsapp") return true;
  if (/^lead\s*\d{3,4}$/.test(lower)) return true;
  return !nomeCandidatoEhValido(n);
}

function capitalizarPalavra(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Normaliza pushName do WhatsApp para exibição no CRM. */
export function pushNameParaNomeExibicao(pushName: string | null | undefined): string | undefined {
  const raw = normalizarNomeTexto(String(pushName ?? ""));
  if (!raw || raw.length < 2) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "whatsapp" || lower === "unknown") return undefined;
  if (!nomeCandidatoEhValido(raw)) return undefined;
  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 4);
  const nome = parts.map(capitalizarPalavra).join(" ").slice(0, 240);
  return nomeLeadEhPlaceholder(nome) ? undefined : nome;
}
