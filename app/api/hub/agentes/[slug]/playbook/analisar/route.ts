import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { loadCurrentPlaybookMarkdown } from "@/lib/playbook/custom-playbook";
import { analyzePlaybookWithMistral, buildLocalPlaybookAnalysisFallback } from "@/lib/playbook/mistral-analysis";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  let markdown: string | null = null;
  let origemPlaybook: "conteudo_body" | "object_path" | "public_url" = "object_path";
  let metaPath: string | null = null;
  let metaUrl: string | null = null;

  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body?.content === "string" && body.content.trim()) {
      markdown = body.content.trim();
      origemPlaybook = "conteudo_body";
    }
  } catch {
    /* body opcional — carrega do storage */
  }

  if (!markdown) {
    const loaded = await loadCurrentPlaybookMarkdown(supabase, slug);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    markdown = loaded.markdown;
    origemPlaybook = loaded.origem;
    metaPath = loaded.playbook_object_path;
    metaUrl = loaded.playbook_public_url;
  }

  const analysis = await analyzePlaybookWithMistral(markdown);
  if (!analysis.ok) {
    const fallback = buildLocalPlaybookAnalysisFallback(markdown);
    return NextResponse.json({
      sucesso: true,
      origem_playbook: origemPlaybook,
      playbook_object_path: metaPath,
      playbook_public_url: metaUrl,
      model: "local-fallback",
      analise: fallback,
      analise_origem: "fallback",
      aviso: analysis.error,
    });
  }

  return NextResponse.json({
    sucesso: true,
    origem_playbook: origemPlaybook,
    playbook_object_path: metaPath,
    playbook_public_url: metaUrl,
    model: analysis.model,
    analise: analysis.analise,
    analise_origem: "mistral",
  });
}
