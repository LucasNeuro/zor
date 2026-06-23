import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import type { FollowupTipoConteudo } from "@/lib/hub/followup-types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseTipo(v: unknown): FollowupTipoConteudo | null {
  if (v == null) return null;
  const s = String(v);
  if (s === "texto" || s === "imagem" || s === "texto_imagem") return s;
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; passoId: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: rawSlug, passoId: rawPasso } = await params;
  const slug = decodeURIComponent(rawSlug);
  const passoId = decodeURIComponent(rawPasso);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const { data: existente } = await supabase
    .from("hub_agente_followup_passo")
    .select("id, agente_slug")
    .eq("id", passoId)
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Passo não encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (body.ordem != null) {
    const ordem = Number.parseInt(String(body.ordem), 10);
    if (!Number.isFinite(ordem) || ordem < 1 || ordem > 24) {
      return NextResponse.json({ error: "ordem inválida" }, { status: 400 });
    }
    patch.ordem = ordem;
  }
  if (body.atraso_horas != null) {
    const h = Number.parseInt(String(body.atraso_horas), 10);
    if (!Number.isFinite(h) || h < 1 || h > 8760) {
      return NextResponse.json({ error: "atraso_horas inválido" }, { status: 400 });
    }
    patch.atraso_horas = h;
  }
  if (body.tipo_conteudo != null) {
    const tipo = parseTipo(body.tipo_conteudo);
    if (!tipo) return NextResponse.json({ error: "tipo_conteudo inválido" }, { status: 400 });
    patch.tipo_conteudo = tipo;
  }
  if (body.texto_template !== undefined) {
    patch.texto_template = body.texto_template != null ? String(body.texto_template) : null;
  }
  if (body.imagem_url !== undefined) {
    patch.imagem_url = body.imagem_url != null ? String(body.imagem_url).trim() || null : null;
  }
  if (body.legenda_imagem !== undefined) {
    patch.legenda_imagem = body.legenda_imagem != null ? String(body.legenda_imagem) : null;
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_agente_followup_passo")
    .update(patch)
    .eq("id", passoId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passo: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; passoId: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: rawSlug, passoId: rawPasso } = await params;
  const slug = decodeURIComponent(rawSlug);
  const passoId = decodeURIComponent(rawPasso);

  const supabase = db();
  const { error } = await supabase
    .from("hub_agente_followup_passo")
    .delete()
    .eq("id", passoId)
    .eq("agente_slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
