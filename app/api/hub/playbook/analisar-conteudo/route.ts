import { NextRequest, NextResponse } from "next/server";
import { analyzePlaybookWithMistral } from "@/lib/playbook/mistral-analysis";
import { normalizePlaybookText } from "@/lib/playbook/custom-playbook";

const MAX_CHARS = 40_000;

/**
 * POST — analisa conteúdo de playbook antes de criar/publicar o agente (sem slug).
 * Body: { content: string, filename?: string }
 */
export async function POST(request: NextRequest) {
  let body: { content?: unknown; filename?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const raw = typeof body.content === "string" ? body.content : "";
  const markdown = normalizePlaybookText(raw);
  if (!markdown.trim()) {
    return NextResponse.json({ error: "Envie o conteúdo do playbook (campo content)." }, { status: 400 });
  }
  if (markdown.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Playbook acima de ${MAX_CHARS} caracteres. Reduza o tamanho.` },
      { status: 413 }
    );
  }

  const analysis = await analyzePlaybookWithMistral(markdown);
  if (!analysis.ok) {
    return NextResponse.json({ error: analysis.error }, { status: analysis.status });
  }

  return NextResponse.json({
    sucesso: true,
    origem: "conteudo_local",
    filename: typeof body.filename === "string" ? body.filename : null,
    model: analysis.model,
    analise: analysis.analise,
  });
}
