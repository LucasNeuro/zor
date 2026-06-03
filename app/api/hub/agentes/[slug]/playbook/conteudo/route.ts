import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  loadCurrentPlaybookMarkdown,
  savePlaybookMarkdownForAgent,
} from "@/lib/playbook/custom-playbook";
import { assessPlaybookFlowInMarkdown } from "@/lib/playbook/playbook-flow-ui";
import { ensureMarkdownWithWhatsappFlow } from "@/lib/playbook/playbook-flow-template";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET — conteúdo Markdown publicado + metadados.
 * PUT — publica Markdown editado (upsert no bucket + refs em hub_agente_identidade).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: meta, error: metaErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, cargo, area, instrucao_modo, playbook_object_path, playbook_public_url, playbook_generated_at, playbook_source_hash"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });
  if (!meta) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  const loaded = await loadCurrentPlaybookMarkdown(supabase, slug, {
    objectPath: meta.playbook_object_path as string | null,
    publicUrl: meta.playbook_public_url as string | null,
  });

  const cacheHeaders = { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" };

  if (!loaded.ok) {
    return NextResponse.json(
      {
        agente_slug: meta.agente_slug,
        nome: meta.nome,
        cargo: meta.cargo,
        area: meta.area,
        instrucao_modo: meta.instrucao_modo,
        playbook_object_path: meta.playbook_object_path,
        playbook_public_url: meta.playbook_public_url,
        playbook_generated_at: meta.playbook_generated_at,
        playbook_source_hash: meta.playbook_source_hash,
        tem_playbook: false,
        error: loaded.error,
      },
      { status: loaded.status === 409 ? 200 : loaded.status, headers: cacheHeaders }
    );
  }

  return NextResponse.json(
    {
      agente_slug: meta.agente_slug,
      nome: meta.nome,
      cargo: meta.cargo,
      area: meta.area,
      instrucao_modo: meta.instrucao_modo,
      playbook_object_path: loaded.playbook_object_path ?? meta.playbook_object_path,
      playbook_public_url: loaded.playbook_public_url ?? meta.playbook_public_url,
      playbook_generated_at: meta.playbook_generated_at,
      playbook_source_hash: meta.playbook_source_hash,
      origem: loaded.origem,
      tem_playbook: true,
      markdown: loaded.markdown,
      bytes: Buffer.byteLength(loaded.markdown, "utf8"),
      fluxo_whatsapp: assessPlaybookFlowInMarkdown(loaded.markdown),
    },
    { headers: cacheHeaders }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  let body: { markdown?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { markdown?: unknown; content?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const markdown =
    typeof body.markdown === "string"
      ? body.markdown
      : typeof body.content === "string"
        ? body.content
        : "";

  const ensured = await ensureMarkdownWithWhatsappFlow(markdown);
  if (!ensured.ok) {
    return NextResponse.json(
      {
        error:
          "Publicação exige bloco de fluxo WhatsApp válido (`obra10_playbook_flow`). Use «Adaptar motor WA» na calibração.",
        errors: ensured.errors,
      },
      { status: 400 }
    );
  }

  const result = await savePlaybookMarkdownForAgent(supabase, slug, ensured.markdown);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    sucesso: true,
    ...result,
    auto_appended_flow: ensured.auto_appended_flow,
    fluxo_whatsapp: assessPlaybookFlowInMarkdown(ensured.markdown),
  });
}
