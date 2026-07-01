/** RFC Fase 5 — tool output offloading: head/tail in-context, corpo truncado. */

const MAX_TOOL_JSON_CHARS = (): number => {
  const raw = process.env.HARNESS_TOOL_OUTPUT_MAX_CHARS?.trim();
  const n = raw ? parseInt(raw, 10) : 6000;
  return Math.min(16_000, Math.max(1500, Number.isFinite(n) ? n : 6000));
};

export function truncarResultadoFerramentaParaModelo(
  resultJson: string,
  toolName?: string
): string {
  const max = MAX_TOOL_JSON_CHARS();
  const t = resultJson.trim();
  if (t.length <= max) return t;

  let parsed: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse(t) as unknown;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      parsed = p as Record<string, unknown>;
    }
  } catch {
    /* não-JSON */
  }

  if (parsed && Array.isArray(parsed.registos) && parsed.registos.length > 8) {
    const total = parsed.registos.length;
    const head = (parsed.registos as unknown[]).slice(0, 5);
    const tail = (parsed.registos as unknown[]).slice(-2);
    return JSON.stringify({
      ...parsed,
      registos: head,
      registos_fim: tail,
      harness_truncado: true,
      total_registos: total,
      aviso: `Lista truncada (${total} registos). Use filtros mais específicos ou paginação na ferramenta.`,
    });
  }

  const head = t.slice(0, Math.floor(max * 0.65));
  const tail = t.slice(-Math.floor(max * 0.25));
  return JSON.stringify({
    harness_truncado: true,
    ferramenta: toolName ?? null,
    preview_inicio: head,
    preview_fim: tail,
    tamanho_original: t.length,
    aviso: "Resposta da ferramenta truncada para caber no contexto. Reconsulte com filtros se precisar de mais linhas.",
  });
}
