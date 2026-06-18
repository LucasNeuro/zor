import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Slug do agente obrigatório." }, { status: 400 });
  }

  let body: { ativo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body.ativo !== "boolean") {
    return NextResponse.json({ error: "Campo ativo (boolean) obrigatório." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_agente_identidade")
    .update({ ativo: body.ativo })
    .eq("agente_slug", slug)
    .select("agente_slug, nome, ativo, tenant_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ data });
}
