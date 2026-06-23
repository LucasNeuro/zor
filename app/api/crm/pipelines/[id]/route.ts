import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { isPipelinePrincipal } from "@/lib/crm/tenant-pipelines";
import { isUuidValido } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;
  if (!isUuidValido(pipelineId)) {
    return NextResponse.json({ error: "Pipeline inválido" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = await resolveTenantIdFromCaller(request);

  const { data: pipe, error: loadErr } = await supabase
    .from("hub_pipelines")
    .select("id, slug, nome, tipo, ativo, tenant_id")
    .eq("id", pipelineId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!pipe?.id) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  if (pipe.tenant_id && String(pipe.tenant_id) !== tenantId) {
    return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  }

  const fields: Record<string, unknown> = {};
  if (typeof body.ativo === "boolean") fields.ativo = body.ativo;
  if (body.nome != null) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    fields.nome = nome;
  }

  if (!Object.keys(fields).length) {
    return NextResponse.json({ error: "Nenhum campo para actualizar" }, { status: 400 });
  }

  if (fields.ativo === false) {
    if (isPipelinePrincipal({ slug: String(pipe.slug), tipo: pipe.tipo as "lead" | "negocio" | "atendimento" })) {
      return NextResponse.json(
        { error: "O pipeline principal não pode ser desactivado." },
        { status: 400 }
      );
    }

    const { count } = await supabase
      .from("hub_pipelines")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("tipo", pipe.tipo)
      .eq("ativo", true)
      .neq("id", pipelineId);

    if ((count ?? 0) < 1) {
      return NextResponse.json(
        { error: "Deve permanecer pelo menos um pipeline activo deste tipo." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("hub_pipelines")
    .update({ ...fields, atualizado_em: new Date().toISOString() })
    .eq("id", pipelineId)
    .select("id, slug, nome, tipo, ativo, ordem")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;
  if (!isUuidValido(pipelineId)) {
    return NextResponse.json({ error: "Pipeline inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = await resolveTenantIdFromCaller(request);

  const { data: pipe, error: loadErr } = await supabase
    .from("hub_pipelines")
    .select("id, slug, nome, tipo, tenant_id")
    .eq("id", pipelineId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!pipe?.id) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  if (pipe.tenant_id && String(pipe.tenant_id) !== tenantId) {
    return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  }

  if (isPipelinePrincipal({ slug: String(pipe.slug), tipo: pipe.tipo as "lead" | "negocio" | "atendimento" })) {
    return NextResponse.json(
      { error: "O pipeline principal de Leads não pode ser excluído." },
      { status: 400 }
    );
  }

  const tipo = String(pipe.tipo ?? "lead");

  if (tipo === "negocio") {
    const { count } = await supabase
      .from("hub_negocios")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipelineId);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${count} negócio(s) neste pipeline.` },
        { status: 409 }
      );
    }
  } else {
    const { count } = await supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipelineId);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: ${count} lead(s) neste pipeline.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("hub_pipelines").delete().eq("id", pipelineId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
