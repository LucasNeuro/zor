const MEET_URL_RE = /https:\/\/meet\.google\.com\/[a-z0-9-]+/gi;

/** Converte markdown comum da IA para texto legível no WhatsApp. */
export function formatarTextoRespostaWhatsapp(texto: string): string {
  let out = texto.trim();
  if (!out) return out;

  // [rótulo](url) ou [url](url) → URL nua (WhatsApp não renderiza markdown)
  out = out.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi, (_m, _label, url: string) => url.trim());

  // **negrito** → *negrito* (formato nativo WhatsApp)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");

  return out;
}

/** Extrai link Meet/Calendar devolvido por hub_int_gcal_criar_evento. */
export function extrairLinkMeetDeToolCalls(
  toolCalls: Array<{ nome: string; ok: boolean; resultadoPreview?: string }> | undefined
): string | null {
  if (!Array.isArray(toolCalls)) return null;

  for (const t of toolCalls) {
    if (t.nome !== "hub_int_gcal_criar_evento" || !t.ok) continue;
    const link = extrairLinkDeResultadoTool(t.resultadoPreview ?? "");
    if (link) return link;
  }
  return null;
}

function extrairLinkDeResultadoTool(preview: string): string | null {
  const raw = preview.trim();
  if (!raw) return null;

  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const direto = j.link_para_whatsapp;
    if (typeof direto === "string" && direto.trim()) return normalizarUrlWhatsapp(direto);

    const evento = j.evento;
    if (evento && typeof evento === "object" && !Array.isArray(evento)) {
      const ev = evento as Record<string, unknown>;
      const meet = ev.link_meet;
      const cal = ev.link_calendario;
      if (typeof meet === "string" && meet.trim()) return normalizarUrlWhatsapp(meet);
      if (typeof cal === "string" && cal.trim()) return normalizarUrlWhatsapp(cal);
    }
  } catch {
    /* preview truncado ou não-JSON */
  }

  const meetMatch = raw.match(MEET_URL_RE);
  if (meetMatch?.[0]) return normalizarUrlWhatsapp(meetMatch[0]);

  return null;
}

function normalizarUrlWhatsapp(url: string): string {
  return url.trim().replace(/[)\].,;]+$/, "");
}

/** Substitui links Meet inventados/errados pelo link oficial da API Google. */
export function corrigirLinksMeetNaResposta(texto: string, linkOficial: string | null): string {
  if (!linkOficial?.trim()) return texto;
  const oficial = normalizarUrlWhatsapp(linkOficial);
  if (!oficial.includes("meet.google.com")) return texto;

  return texto.replace(MEET_URL_RE, (match) => {
    const norm = normalizarUrlWhatsapp(match);
    return norm.toLowerCase() === oficial.toLowerCase() ? norm : oficial;
  });
}

/** Pipeline completo antes de enviar resposta da IA no WhatsApp. */
export function prepararTextoIaParaWhatsapp(
  texto: string,
  toolCalls?: Array<{ nome: string; ok: boolean; resultadoPreview?: string }>
): string {
  const linkMeet = extrairLinkMeetDeToolCalls(toolCalls);
  let out = formatarTextoRespostaWhatsapp(texto);
  out = corrigirLinksMeetNaResposta(out, linkMeet);
  return out;
}
