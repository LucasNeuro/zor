import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const artefatoId = (id || "").trim();

  if (!UUID_RE.test(artefatoId)) {
    return new NextResponse("Artefacto inválido.", { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_superagente_artefatos")
    .select("titulo, conteudo_html, criado_em")
    .eq("id", artefatoId)
    .maybeSingle();

  if (error) {
    return new NextResponse("Erro ao carregar artefacto.", { status: 500 });
  }

  const html = typeof data?.conteudo_html === "string" ? data.conteudo_html.trim() : "";
  if (!html) {
    return new NextResponse("Artefacto não encontrado ou sem conteúdo.", { status: 404 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
