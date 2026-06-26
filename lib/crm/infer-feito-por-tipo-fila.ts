export type FeitoPorTipoFila = "humano" | "ia" | "cliente" | "sistema";

/**
 * Classifica quem enviou uma linha de hub_fila_mensagens.
 * Saída só é humana com marca explícita (assumir atendimento / envio manual).
 */
export function inferFeitoPorTipoFila(
  meta: Record<string, unknown>,
  direcao: string,
  rowFeitoPorTipo?: unknown
): FeitoPorTipoFila | null {
  const fromRow =
    typeof rowFeitoPorTipo === "string" && rowFeitoPorTipo.trim()
      ? rowFeitoPorTipo.trim().toLowerCase()
      : null;
  const fromMeta =
    typeof meta.feito_por_tipo === "string" && meta.feito_por_tipo.trim()
      ? meta.feito_por_tipo.trim().toLowerCase()
      : null;

  const explicit = fromRow ?? fromMeta;
  if (
    explicit === "humano" ||
    explicit === "ia" ||
    explicit === "cliente" ||
    explicit === "sistema"
  ) {
    return explicit;
  }

  if (direcao === "entrada") return "cliente";

  if (meta.tipo === "followup_automatico") return "ia";
  if (meta.origem_backfill || meta.feito_por === "backfill" || meta.feito_por === "engine") {
    return "ia";
  }
  if (meta.motor || meta.modelo || meta.logId) return "ia";

  return "ia";
}

export function remetenteFilaFromFeitoPor(
  direcao: string,
  feitoPorTipo: FeitoPorTipoFila | null
): "lead" | "humano" | "ia" {
  if (direcao === "entrada") return "lead";
  return feitoPorTipo === "humano" ? "humano" : "ia";
}
