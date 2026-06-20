import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  if (body.nome != null) fields.nome = String(body.nome).trim();
  if (body.email != null) fields.email = String(body.email).trim().toLowerCase();
  if (body.telefone != null) fields.telefone = String(body.telefone).trim() || null;
  if (body.empresa != null) fields.empresa = String(body.empresa).trim() || null;
  if (body.mensagem != null) fields.mensagem = String(body.mensagem).trim() || null;
  if (body.interesse_principal != null) {
    fields.interesse_principal = String(body.interesse_principal).trim() || null;
  }
  if (body.tamanho_equipe != null) fields.tamanho_equipe = String(body.tamanho_equipe).trim() || null;
  if (body.prazo_inicio != null) fields.prazo_inicio = String(body.prazo_inicio).trim() || null;
  if (body.origem != null) fields.origem = String(body.origem).trim() || "landing_mini_bot";
  if (body.pagina_url != null) fields.pagina_url = String(body.pagina_url).trim() || null;
  if (body.respostas != null && Array.isArray(body.respostas)) fields.respostas = body.respostas;

  const { data, error } = await crmDb()
    .from("waje_landing_interesse")
    .update(fields)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Registo não encontrado." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const { error } = await crmDb().from("waje_landing_interesse").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
