/** Normaliza telefone para lista gestor (DDI + número, só dígitos). */
export function normalizarTelefoneGestorLista(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.slice(0, 15);
}

export function parseTelefonesGestorInput(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const parte of texto.split(/[\n,;]+/)) {
    const n = normalizarTelefoneGestorLista(parte);
    if (n.length >= 12 && !vistos.has(n)) {
      vistos.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Exibição BR: +55 (11) 91981-5058 */
export function formatarTelefoneGestorExibicao(digits: string): string {
  const d = normalizarTelefoneGestorLista(digits);
  if (d.length < 12) return d;
  const ddi = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 11) {
    return `+${ddi} (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  }
  if (rest.length === 10) {
    return `+${ddi} (${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
  }
  return `+${d}`;
}
