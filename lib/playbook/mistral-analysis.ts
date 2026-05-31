import { mistralChatCompletion } from "@/lib/ia/mistral-chat";

export type PlaybookAnalysis = {
  pontos_fortes: string[];
  gaps: string[];
  riscos: string[];
  sugestoes: string[];
  resumo_executivo: string;
  /** Nota de qualidade 0–10 atribuída pela IA. */
  nota: number;
  nota_comentario: string;
};

export type PlaybookAnalysisResult =
  | { ok: true; analise: PlaybookAnalysis; model: string }
  | { ok: false; status: number; error: string };

const ANALYSIS_SCHEMA_EXAMPLE = {
  resumo_executivo: "string curto (1-3 frases)",
  nota: 8.5,
  nota_comentario: "string curto explicando a nota",
  pontos_fortes: ["string", "string"],
  gaps: ["string", "string"],
  riscos: ["string", "string"],
  sugestoes: ["string", "string"],
};

const ANALYSIS_SYSTEM_PROMPT = `Você é um auditor de playbooks operacionais para agentes de atendimento.
Avalie qualidade, cobertura e segurança operacional.
Responda APENAS em JSON válido, sem markdown, sem comentários extras.
Formato obrigatório:
${JSON.stringify(ANALYSIS_SCHEMA_EXAMPLE)}
Regras:
- 3 a 7 itens por lista.
- Itens curtos, concretos e acionáveis.
- nota: número de 0 a 10 (pode usar decimal, ex.: 7.5) sobre clareza, cobertura operacional e segurança.
- nota_comentario: 1–2 frases justificando a nota.
- Português (Brasil).`;

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fromFence = trimmed.replace(/^```json\s*|```$/gi, "").trim();
  const start = fromFence.indexOf("{");
  const end = fromFence.lastIndexOf("}");
  const maybeJson = start >= 0 && end > start ? fromFence.slice(start, end + 1) : fromFence;
  return JSON.parse(maybeJson);
}

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const cleaned = item.replace(/\s+/g, " ").trim();
    if (cleaned) out.push(cleaned);
    if (out.length >= 7) break;
  }
  return out;
}

function parseNota(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
  }
  return null;
}

function parsePlaybookAnalysis(raw: string): PlaybookAnalysis | null {
  try {
    const parsed = parseJsonObject(raw) as Record<string, unknown>;
    const resumo = typeof parsed.resumo_executivo === "string" ? parsed.resumo_executivo.trim() : "";
    const nota = parseNota(parsed.nota);
    const notaComentario =
      typeof parsed.nota_comentario === "string" ? parsed.nota_comentario.trim() : "";
    const pontosFortes = normalizeList(parsed.pontos_fortes);
    const gaps = normalizeList(parsed.gaps);
    const riscos = normalizeList(parsed.riscos);
    const sugestoes = normalizeList(parsed.sugestoes);
    if (!resumo) return null;
    if (nota == null || !notaComentario) return null;
    if (!pontosFortes.length || !gaps.length || !riscos.length || !sugestoes.length) return null;
    return {
      resumo_executivo: resumo,
      nota,
      nota_comentario: notaComentario,
      pontos_fortes: pontosFortes,
      gaps,
      riscos,
      sugestoes,
    };
  } catch {
    return null;
  }
}

export async function analyzePlaybookWithMistral(markdown: string): Promise<PlaybookAnalysisResult> {
  if (!process.env.MISTRAL_API_KEY?.trim()) {
    return { ok: false, status: 503, error: "MISTRAL_API_KEY não configurada no servidor." };
  }

  const model = process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest";
  const prompt =
    markdown.length > 40_000
      ? `${markdown.slice(0, 40_000)}\n\n[playbook truncado para análise de contexto]`
      : markdown;

  const completion = await mistralChatCompletion({
    model,
    system: ANALYSIS_SYSTEM_PROMPT,
    maxTokens: 1200,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content:
          "Analise o playbook abaixo e devolva recomendações estruturadas no JSON solicitado.\n\nPLAYBOOK:\n" +
          prompt,
      },
    ],
  });

  if (!completion.ok) {
    return { ok: false, status: 502, error: completion.error };
  }

  const parsed = parsePlaybookAnalysis(completion.text);
  if (!parsed) {
    return {
      ok: false,
      status: 502,
      error: "Não foi possível interpretar a análise do Mistral em JSON estruturado.",
    };
  }

  return { ok: true, analise: parsed, model: completion.model };
}

export function _parsePlaybookAnalysisForTests(raw: string): PlaybookAnalysis | null {
  return parsePlaybookAnalysis(raw);
}
