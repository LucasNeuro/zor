import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { loadCurrentPlaybookMarkdown } from "@/lib/playbook/custom-playbook";
import { aplicarFluxoEmpresaAoMarkdown } from "@/lib/playbook/playbook-flow-from-context";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Gera bloco waje_playbook_flow a partir do cargo, conhecimento do agente
 * e análise da base documental do tenant (sem template genérico de assistência).
 */
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

  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body?.content === "string" && body.content.trim()) {
      markdown = body.content.trim();
    }
  } catch {
    /* body opcional */
  }

  if (!markdown) {
    const loaded = await loadCurrentPlaybookMarkdown(supabase, slug);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    markdown = loaded.markdown;
  }

  const result = await aplicarFluxoEmpresaAoMarkdown(supabase, slug, markdown);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    sucesso: true,
    markdown: result.markdown,
    action: result.action,
    message: result.message,
    resumo_contexto: result.resumo,
  });
}
