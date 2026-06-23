import { NextRequest, NextResponse } from "next/server";
import {
  patchPipelineEstagio,
  patchPipelineEstagioOrdem,
} from "@/lib/crm/pipeline-estagios-db";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { isUuidValido } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

function pipelineIdInvalido(id: string) {
  return !isUuidValido(id);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;
  if (pipelineIdInvalido(pipelineId)) {
    return NextResponse.json({ error: "Pipeline inválido" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = crmDb();

  if (Array.isArray(body.reorder)) {
    const slugs = body.reorder.map((s) => String(s).trim()).filter(Boolean);
    if (!slugs.length) {
      return NextResponse.json({ error: "reorder vazio" }, { status: 400 });
    }

    for (let i = 0; i < slugs.length; i++) {
      const { error } = await patchPipelineEstagioOrdem(supabase, pipelineId, slugs[i], i);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reorder: slugs });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  if (typeof body.ativo === "boolean") fields.ativo = body.ativo;
  if (body.label != null) fields.label = String(body.label).trim();
  if (body.cor != null) fields.cor = String(body.cor).trim();
  if (body.ordem != null) fields.ordem = Number(body.ordem);

  if (!Object.keys(fields).length) {
    return NextResponse.json({ error: "Nenhum campo para actualizar" }, { status: 400 });
  }

  const { data, error } = await patchPipelineEstagio(supabase, pipelineId, slug, fields);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Estágio não encontrado" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;
  if (pipelineIdInvalido(pipelineId)) {
    return NextResponse.json({ error: "Pipeline inválido" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = String(body.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  const label = String(body.label || slug).trim();
  if (!slug || slug.length < 2) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const { count } = await supabase
    .from("hub_pipeline_estagios")
    .select("*", { count: "exact", head: true })
    .eq("pipeline_id", pipelineId);

  const { data, error } = await supabase
    .from("hub_pipeline_estagios")
    .insert({
      pipeline_id: pipelineId,
      slug,
      label,
      cor: String(body.cor || "#6B7280"),
      ordem: Number(body.ordem ?? count ?? 0),
      tipo_fecho: String(body.tipo_fecho || "aberto"),
      sistema: false,
      ativo: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;
  if (pipelineIdInvalido(pipelineId)) {
    return NextResponse.json({ error: "Pipeline inválido" }, { status: 400 });
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });

  const supabase = crmDb();

  const { data: pipe } = await supabase
    .from("hub_pipelines")
    .select("tipo")
    .eq("id", pipelineId)
    .maybeSingle();

  const tipo = String(pipe?.tipo ?? "lead");

  if (tipo === "negocio") {
    const { count } = await supabase
      .from("hub_negocios")
      .select("id", { count: "exact", head: true })
      .eq("etapa", slug);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${count} negócio(s) nesta etapa.` },
        { status: 409 }
      );
    }
  } else {
    const { count } = await supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("estagio", slug);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${count} lead(s) neste estágio.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from("hub_pipeline_estagios")
    .delete()
    .eq("pipeline_id", pipelineId)
    .eq("slug", slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
