/**
 * VERIFY — classifica resultado JSON de ferramenta para o loop ReAct.
 */
export type ToolVerifyOutcome = "ok" | "erro" | "aviso" | "desconhecido";

export function verificarResultadoFerramenta(resultJson: string): {
  outcome: ToolVerifyOutcome;
  ok: boolean;
  mensagem?: string;
} {
  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;
    if (parsed.ok === true) {
      return { outcome: "ok", ok: true };
    }
    if (parsed.ok === false || typeof parsed.erro === "string") {
      return {
        outcome: "erro",
        ok: false,
        mensagem: String(parsed.erro ?? parsed.mensagem ?? "ferramenta falhou"),
      };
    }
    if (typeof parsed.aviso === "string") {
      return { outcome: "aviso", ok: true, mensagem: parsed.aviso };
    }
    return { outcome: "desconhecido", ok: true };
  } catch {
    const t = resultJson.trim();
    if (!t) return { outcome: "erro", ok: false, mensagem: "resposta vazia" };
    return { outcome: "desconhecido", ok: true };
  }
}

/** Anexa hint de REFLECT ao resultado quando VERIFY falha (observation enriquecida). */
export function enriquecerObservationComVerify(
  resultJson: string,
  nomeFerramenta: string
): string {
  const v = verificarResultadoFerramenta(resultJson);
  if (v.ok && v.outcome !== "erro") return resultJson;
  let base: Record<string, unknown> = {};
  try {
    const p = JSON.parse(resultJson || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) base = p as Record<string, unknown>;
  } catch {
    base = { raw: resultJson.slice(0, 500) };
  }
  return JSON.stringify({
    ...base,
    harness_verify: {
      passou: false,
      ferramenta: nomeFerramenta,
      reflexao:
        "A acção falhou ou devolveu erro. Analise o JSON, ajuste argumentos ou escolha outra ferramenta antes de responder ao utilizador.",
      detalhe: v.mensagem ?? null,
    },
  });
}
