import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  contarMemoriasAgente,
  limparMemoriasAgente,
} from "@/lib/hub/limpar-memorias-agente";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw).trim();
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  const supabase = db();
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  const contagem = await contarMemoriasAgente(supabase, slug);
  return NextResponse.json(contagem);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw).trim();
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  let incluirBriefing = true;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.incluir_briefing === false) {
      incluirBriefing = false;
    }
  } catch {
    /* body opcional */
  }

  const supabase = db();
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  try {
    const resultado = await limparMemoriasAgente(supabase, slug, { incluirBriefing });
    return NextResponse.json({
      ok: true,
      agente_slug: slug,
      ...resultado,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao limpar memórias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
