import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { updateHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";

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
    return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { motivo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Body JSON inválido." }, { status: 400 });
  }

  const motivo = (body.motivo || "").trim();
  if (motivo.length < 10) {
    return NextResponse.json(
      { erro: "Informe o motivo do arquivamento (mínimo 10 caracteres)." },
      { status: 400 }
    );
  }

  const supabase = db();
  const { data, error } = await updateHubAgenteIdentidadeCompat(supabase, slug, {
    arquivado_em: new Date().toISOString(),
    arquivado_motivo: motivo,
    ativo: false,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/arquivado_em/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) {
      return NextResponse.json(
        {
          erro:
            "Arquivamento indisponível neste ambiente. Execute no Supabase o ficheiro supabase/scripts/ensure_hub_agente_arquivado_em.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });
  }

  const agenteSlug = typeof data.agente_slug === "string" ? data.agente_slug : slug;
  return NextResponse.json({ ok: true, agente_slug: agenteSlug });
}
