import { NextRequest, NextResponse } from "next/server";
import { estagiosPadraoParaTipo } from "@/lib/crm/pipeline-defaults";
import { resolveValidatedTenantId } from "@/lib/crm/resolve-tenant-from-caller";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { ensureTenantPipelines, listTenantPipelines } from "@/lib/crm/tenant-pipelines";

type PipelineTipoApi = "lead" | "negocio" | "atendimento";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: tenantResolved.error }, { status: tenantResolved.status });
  }

  const tipo = (request.nextUrl.searchParams.get("tipo") || "lead").trim() as PipelineTipoApi;
  const tenantId = tenantResolved.tenantId;
  const supabase = crmDb();

  try {
    const incluirInativos =
      request.nextUrl.searchParams.get("incluir_inativos") === "1" ||
      request.nextUrl.searchParams.get("admin") === "1";
    const pipelines = await listTenantPipelines(supabase, tenantId, tipo, {
      incluirInativos,
    });
    return NextResponse.json({ data: pipelines });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao listar pipelines";
    if (msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Tabelas de pipeline não encontradas. Aplique as migrações Supabase." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: tenantResolved.error }, { status: tenantResolved.status });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nome = String(body.nome || "").trim();
  const tipo = String(body.tipo || "lead").trim() as PipelineTipoApi;
  const slugBase = String(body.slug || nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const supabase = crmDb();
  const tenantId = tenantResolved.tenantId;

  try {
    await ensureTenantPipelines(supabase, tenantId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao preparar pipelines";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { count } = await supabase
    .from("hub_pipelines")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("ativo", true);

  const { data: pipeline, error } = await supabase
    .from("hub_pipelines")
    .insert({
      slug: `${slugBase}-${Date.now().toString(36)}`,
      nome,
      tipo,
      mercado_sigla: null,
      tenant_id: tenantId,
      ordem: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const estagiosInsert = estagiosPadraoParaTipo(tipo).map((e) => ({
    pipeline_id: pipeline.id,
    slug: e.slug,
    label: e.label,
    cor: e.cor,
    ordem: e.ordem,
    tipo_fecho: e.tipo_fecho,
    sistema: true,
  }));

  await supabase.from("hub_pipeline_estagios").insert(estagiosInsert);

  return NextResponse.json({ data: pipeline }, { status: 201 });
}
