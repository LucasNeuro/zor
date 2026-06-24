import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  loadCurrentPlaybookMarkdown,
  savePlaybookMarkdownForAgent,
} from "@/lib/playbook/custom-playbook";
import { assessPlaybookFlowInMarkdown, agenteUsaFluxoWhatsappPlaybook } from "@/lib/playbook/playbook-flow-ui";
import { ensureMarkdownWithWhatsappFlow } from "@/lib/playbook/playbook-flow-template";
import { aplicarFluxoEmpresaAoMarkdown } from "@/lib/playbook/playbook-flow-from-context";
import { PLAYBOOK_FLOW_FENCE_TAG } from "@/lib/playbook/flow-schema";
import { selectHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";
import { PLAYBOOK_BUCKET, playbookObjectPath } from "@/lib/playbook/persist";

const PLAYBOOK_META_COLS = [
  "agente_slug",
  "nome",
  "cargo",
  "area",
  "instrucao_modo",
  "modo_operacao",
  "tenant_id",
  "playbook_object_path",
  "playbook_public_url",
  "playbook_generated_at",
  "playbook_source_hash",
] as const;

function resolverPathsPlaybook(
  supabase: ReturnType<typeof db>,
  meta: Record<string, unknown>,
  slug: string
): { objectPath: string | null; publicUrl: string | null } {
  let objectPath = String(meta.playbook_object_path ?? "").trim() || null;
  let publicUrl = String(meta.playbook_public_url ?? "").trim() || null;

  if (!objectPath && !publicUrl) {
    const inferred = playbookObjectPath(
      typeof meta.tenant_id === "string" ? meta.tenant_id : null,
      slug
    );
    objectPath = inferred;
    const { data: pub } = supabase.storage.from(PLAYBOOK_BUCKET).getPublicUrl(inferred);
    publicUrl = pub?.publicUrl?.trim() || null;
  }

  return { objectPath, publicUrl };
}

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

  const { data: meta, error: metaErr } = await selectHubAgenteIdentidadeCompat(
    supabase,
    slug,
    [...PLAYBOOK_META_COLS]
  );

  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });
  if (!meta) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  const paths = resolverPathsPlaybook(supabase, meta, slug);
  const loaded = await loadCurrentPlaybookMarkdown(supabase, slug, paths);

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

  const trimmed = markdown.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Playbook vazio." }, { status: 400 });
  }

  const { data: meta, error: metaErr } = await selectHubAgenteIdentidadeCompat(supabase, slug, [
    "agente_slug",
    "modo_operacao",
  ]);
  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });
  if (!meta) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  const modoOperacao =
    typeof meta.modo_operacao === "string" ? meta.modo_operacao.trim() : null;
  const exigeFluxoWhatsapp = agenteUsaFluxoWhatsappPlaybook(modoOperacao);

  let markdownFinal = trimmed;
  let autoAppendedFlow = false;

  if (exigeFluxoWhatsapp) {
    const fluxoExistente = assessPlaybookFlowInMarkdown(trimmed);
    if (fluxoExistente.kind === "ready") {
      markdownFinal = trimmed;
    } else {
      const fluxoEmpresa = await aplicarFluxoEmpresaAoMarkdown(supabase, slug, trimmed);
      if (fluxoEmpresa.ok) {
        markdownFinal = fluxoEmpresa.markdown;
        autoAppendedFlow = fluxoEmpresa.action === "appended_flow";
      } else {
        const ensured = await ensureMarkdownWithWhatsappFlow(trimmed);
        if (!ensured.ok) {
          return NextResponse.json(
            {
              error: `Publicação exige bloco de fluxo WhatsApp válido (\`${PLAYBOOK_FLOW_FENCE_TAG}\`). Use «Gerar fluxo da empresa» na calibração.`,
              errors: ensured.errors,
              detail: fluxoEmpresa.error,
            },
            { status: 400 }
          );
        }
        markdownFinal = ensured.markdown;
        autoAppendedFlow = ensured.auto_appended_flow;
      }
    }
  }

  const result = await savePlaybookMarkdownForAgent(supabase, slug, markdownFinal);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    sucesso: true,
    ...result,
    auto_appended_flow: autoAppendedFlow,
    fluxo_whatsapp: assessPlaybookFlowInMarkdown(markdownFinal),
  });
}
