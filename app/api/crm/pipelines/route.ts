import { NextRequest, NextResponse } from "next/server";
import { ESTAGIOS_PADRAO } from "@/lib/crm/pipeline-defaults";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tipo = request.nextUrl.searchParams.get("tipo") || "lead";
  const mercado = request.nextUrl.searchParams.get("mercado") || "";
  const supabase = crmDb();

  let query = supabase
    .from("hub_pipelines")
    .select(
      "id, slug, nome, tipo, mercado_sigla, ativo, ordem, hub_pipeline_estagios(id, slug, label, cor, ordem, ativo, tipo_fecho, sistema)"
    )
    .eq("tipo", tipo)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (mercado) {
    query = query.or(`mercado_sigla.eq.${mercado},mercado_sigla.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("does not exist")) {
      return NextResponse.json({
        data: [
          {
            id: "fallback",
            slug: `${tipo}-global`,
            nome: tipo === "lead" ? "Leads — Pipeline global" : "Negócios — Pipeline global",
            tipo,
            mercado_sigla: null,
            estagios: ESTAGIOS_PADRAO.map((e) => ({
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pipelines = (data || []).map((p) => {
    const raw = p as Record<string, unknown>;
    const estagios = (raw.hub_pipeline_estagios as Record<string, unknown>[] | null) || [];
    const sorted = [...estagios].sort(
      (a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)
    );
    return {
      id: raw.id,
      slug: raw.slug,
      nome: raw.nome,
      tipo: raw.tipo,
      mercado_sigla: raw.mercado_sigla,
      estagios: sorted,
    };
  });

  if (pipelines.length === 0) {
    return NextResponse.json({
      data: [
        {
          id: "fallback",
          slug: `${tipo}-global`,
          nome: tipo === "lead" ? "Leads — Pipeline global" : "Negócios — Pipeline global",
          tipo,
          mercado_sigla: null,
          estagios: ESTAGIOS_PADRAO.map((e) => ({
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

  return NextResponse.json({ data: pipelines });
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
  const mercado_sigla = body.mercado_sigla ? String(body.mercado_sigla).trim() : null;
  const slugBase = String(body.slug || nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const { data: pipeline, error } = await supabase
    .from("hub_pipelines")
    .insert({
      slug: `${slugBase}-${Date.now().toString(36)}`,
      nome,
      tipo,
      mercado_sigla,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const estagiosInsert = ESTAGIOS_PADRAO.map((e) => ({
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
