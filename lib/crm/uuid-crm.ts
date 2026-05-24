/**
 * Validação de UUID para rotas CRM.
 * Postgres aceita qualquer UUID com formato 8-4-4-4-12 (inclui seeds legados
 * como bbbbbbbb-0001-0001-0001-000000000002, que não passam em RFC 4122 estrito).
 */
export const UUID_FORMATO_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 estrito (variante 8/9/a/b e versão 1–5) — só quando precisar. */
export const UUID_RFC4122_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizarIdUuid(raw: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (UUID_FORMATO_RE.test(t)) return t.toLowerCase();
  const compact = t.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return [
      compact.slice(0, 8),
      compact.slice(8, 12),
      compact.slice(12, 16),
      compact.slice(16, 20),
      compact.slice(20),
    ]
      .join("-")
      .toLowerCase();
  }
  return null;
}

export function idUuidValido(raw: string): boolean {
  return normalizarIdUuid(raw) !== null;
}
