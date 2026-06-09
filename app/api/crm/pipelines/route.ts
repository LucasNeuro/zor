import { NextRequest, NextResponse } from "next/server";
import { estagiosPadraoParaTipo } from "@/lib/crm/pipeline-defaults";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { ensureTenantPipelines, listTenantPipelines } from "@/lib/crm/tenant-pipelines";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

function fallbackResponse(tipo: "lead" | "negocio") {
  const estagios = estagiosPadraoParaTipo(tipo);
  return NextResponse.json({
    data: [
      {
        id: "fallback",
        slug: `${tipo}-principal`,
        nome: tipo === "lead" ? "Leads" : "Negócios",
        tipo,
        mercado_sigla: null,
        ordem: 0,
        estagios: estagios.map((e) => ({
          id: e.slug,
          slug: e.slug,
          label: e.label,
          cor: e.cor,
          ordem: e.ordem,
          ativo: true,
          tipo_fecho: e.tipo_fecho,
          sistema: true,
        })),
      },
    ],
  });
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tipo = (request.nextUrl.searchParams.get("tipo") || "lead").trim() as "lead" | "negocio";
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  try {
    const pipelines = await listTenantPipelines(supabase, tenantId, tipo);
    if (pipelines.length === 0) return fallbackResponse(tipo);
    return NextResponse.json({ data: pipelines });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao listar pipelines";
    if (msg.includes("does not exist")) return fallbackResponse(tipo);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nome = String(body.nome || "").trim();
  const tipo = String(body.tipo || "lead").trim() as "lead" | "negocio";
  const slugBase = String(body.slug || nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  await ensureTenantPipelines(supabase, tenantId);

  const { count } = await supabase
    .from("hub_pipelines")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("ativo", true);

  if (tipo === "negocio" && (count ?? 0) >= 1) {
    return NextResponse.json(
      {
        error:
          "Negócios usa um único funil por empresa. Personalize os estágios em Estágios.",
      },
      { status: 400 }
    );
  }

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
