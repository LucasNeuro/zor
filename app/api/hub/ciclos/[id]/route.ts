import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";

type CicloTipo = "continuo" | "programado" | "gatilho";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isCicloTipo(v: unknown): v is CicloTipo {
  return v === "continuo" || v === "programado" || v === "gatilho";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const supabase = db();
  const { data, error } = await supabase
    .from("hub_ciclos_ia")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("agente_slug" in body) patch.agente_slug = String(body.agente_slug || "").trim();
  if ("nome" in body) patch.nome = String(body.nome || "").trim();
  if ("descricao" in body) {
    const descricao = String(body.descricao || "").trim();
    patch.descricao = descricao.length > 0 ? descricao : null;
  }
  if ("tipo" in body) {
    if (!isCicloTipo(body.tipo)) {
      return NextResponse.json({ error: "tipo inválido." }, { status: 400 });
    }
    patch.tipo = body.tipo;
  }
  if ("cron_expressao" in body) {
    const cron = String(body.cron_expressao || "").trim();
    patch.cron_expressao = cron.length > 0 ? cron : null;
  }
  if ("intervalo_minutos" in body) {
    if (body.intervalo_minutos == null || body.intervalo_minutos === "") {
      patch.intervalo_minutos = null;
    } else {
      const intervalo = Number.parseInt(String(body.intervalo_minutos), 10);
      if (!Number.isFinite(intervalo) || intervalo <= 0) {
        return NextResponse.json({ error: "intervalo_minutos inválido." }, { status: 400 });
      }
      patch.intervalo_minutos = intervalo;
    }
  }
  if ("ativo" in body) patch.ativo = body.ativo === true;
  if ("configuracoes" in body) {
    const parsed = validateAndNormalizeCicloConfiguracoes(body.configuracoes);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    patch.configuracoes = parsed.value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }
  if ("agente_slug" in patch && !String(patch.agente_slug).trim()) {
    return NextResponse.json({ error: "agente_slug inválido." }, { status: 400 });
  }
  if ("nome" in patch && !String(patch.nome).trim()) {
    return NextResponse.json({ error: "nome inválido." }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_ciclos_ia")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const supabase = db();

  const { data: existing, error: checkError } = await supabase
    .from("hub_ciclos_ia")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const { error } = await supabase.from("hub_ciclos_ia").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
