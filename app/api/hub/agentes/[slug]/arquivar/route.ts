import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .update({
      arquivado_em: new Date().toISOString(),
      arquivado_motivo: motivo,
      ativo: false,
    })
    .eq("agente_slug", slug)
    .select("agente_slug")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, agente_slug: data.agente_slug });
}
