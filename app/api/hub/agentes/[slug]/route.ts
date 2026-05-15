import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { runPlaybookPipeline } from "@/lib/playbook/orchestrate";
import { deleteAgenteHubCompleto } from "@/lib/hub/delete-agente-completo";

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
  const slug = decodeURIComponent(raw);

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const allowed = [
    "nome",
    "prefixo_mercado",
    "personalidade",
    "horario_inicio",
    "horario_fim",
    "dias_semana",
    "bio",
    "tom_voz",
    "estilo_comunicacao",
    "system_prompt_base",
    "avatar_url",
    "ativo",
    "modo_operacao",
    "ciclo_execucao_padrao",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const supabase = db();
  const { data: current, error: currentError } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, ativo, arquivado_em")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const arquivado = current.arquivado_em != null;
  if ("ativo" in patch) {
    const nextAtivo = patch.ativo === true;
    // Regra única de estado: agente arquivado sempre permanece inativo.
    if (arquivado && nextAtivo) {
      return NextResponse.json(
        { error: "Agente arquivado não pode ser reativado. Use fluxo específico de desarquivamento." },
        { status: 409 }
      );
    }
    if (arquivado) patch.ativo = false;
  }

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .update(patch)
    .eq("agente_slug", slug)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const updated = data as { agente_slug: string };
  const sb = supabase;
  after(async () => {
    try {
      const out = await runPlaybookPipeline(sb, updated.agente_slug);
      if (!out.ok) {
        console.error("[playbook] pós-atualização agente:", updated.agente_slug, out.error);
      }
    } catch (e) {
      console.error("[playbook] pós-atualização agente (exceção):", updated.agente_slug, e);
    }
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const supabase = db();
  const result = await deleteAgenteHubCompleto(supabase, slug);

  if (!result.ok) {
    const msg = result.error;
    const is404 = msg.includes("não encontrado") || /not found/i.test(msg);
    return NextResponse.json({ error: msg }, { status: is404 ? 404 : 500 });
  }

  return NextResponse.json({ ok: true, agente_slug: slug });
}
