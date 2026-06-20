import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { normalizeUserRow, toDbRecordStatus, updateUserById } from "@/lib/crm/users-row";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const { data, error } = await crmDb()
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });

  let tenant_nome: string | null = null;
  if (data.tenant_id) {
    const { data: tenant } = await crmDb()
      .from("hub_tenants")
      .select("nome_exibicao, slug")
      .eq("id", data.tenant_id)
      .maybeSingle();
    tenant_nome = tenant ? String(tenant.nome_exibicao ?? tenant.slug ?? "") : null;
  }

  return NextResponse.json({
    data: { ...normalizeUserRow(data as Record<string, unknown>), tenant_nome },
  });
}

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
  if (body.name != null) fields.name = String(body.name).trim();
  if (body.email != null) fields.email = String(body.email).trim().toLowerCase();
  if (body.phone != null) fields.phone = String(body.phone).trim() || null;
  if (body.role != null) fields.role = String(body.role).trim();
  if (body.status != null) fields.status = toDbRecordStatus(String(body.status));
  if ("tenant_id" in body) fields.tenant_id = body.tenant_id ? String(body.tenant_id) : null;
  if ("owner" in body) fields.owner = body.owner === true;
  if ("access_role_id" in body) {
    fields.access_role_id = body.access_role_id ? String(body.access_role_id) : null;
  }
  if (body.document_type != null) fields.document_type = body.document_type || null;
  if (body.document != null) fields.document = body.document || null;
  if (body.billing_legal_name != null) {
    fields.billing_legal_name = body.billing_legal_name || null;
  }

  const { data, error } = await updateUserById(crmDb(), id, fields);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });

  return NextResponse.json({ data: normalizeUserRow(data) });
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const { data, error } = await updateUserById(crmDb(), id, { status: "Inativo" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true, data: normalizeUserRow(data) });
}
