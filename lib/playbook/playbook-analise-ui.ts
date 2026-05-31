import type { PlaybookAnaliseResultado } from "@/components/crm/PlaybookUploadAnalisePanel";

function toLinhasLista(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pickTexto(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizarAnalisePlaybook(raw: Record<string, unknown>): PlaybookAnaliseResultado {
  const nested =
    raw.analise && typeof raw.analise === "object" && !Array.isArray(raw.analise)
      ? (raw.analise as Record<string, unknown>)
      : raw;
  const resumo =
    pickTexto(nested, ["resumo_executivo", "resumo", "summary", "analise_resumo", "analysis"]) ||
    pickTexto(raw, ["resumo", "summary"]) ||
    "Análise concluída sem resumo estruturado.";
  const notaRaw = nested.nota ?? raw.nota;
  const nota =
    typeof notaRaw === "number" && Number.isFinite(notaRaw)
      ? Math.min(10, Math.max(0, Math.round(notaRaw * 10) / 10))
      : typeof notaRaw === "string"
        ? (() => {
            const n = Number.parseFloat(notaRaw.replace(",", "."));
            return Number.isFinite(n) ? Math.min(10, Math.max(0, Math.round(n * 10) / 10)) : null;
          })()
        : null;
  const notaComentario = pickTexto(nested, ["nota_comentario", "notaComentario"]);
  const pontosChave = toLinhasLista(
    nested.pontos_fortes ?? nested.pontos_chave ?? nested.highlights ?? nested.insights
  );
  const gaps = toLinhasLista(nested.gaps ?? nested.lacunas);
  const riscos = toLinhasLista(nested.riscos ?? nested.risks);
  const recomendacoes = toLinhasLista(
    nested.sugestoes ?? nested.recomendacoes ?? nested.recommendations ?? nested.proximos_passos
  );
  const textoBruto =
    pickTexto(raw, ["texto", "raw_text", "resultado", "output", "content"]) ||
    JSON.stringify(raw, null, 2);
  const modelo = pickTexto(raw, ["model", "modelo"]) || null;

  return {
    resumo,
    nota,
    notaComentario,
    pontosChave,
    gaps,
    riscos,
    recomendacoes,
    textoBruto,
    modelo,
    origem: "mistral",
  };
}
