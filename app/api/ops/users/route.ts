import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { normalizeUserRow, toDbRecordStatus } from "@/lib/crm/users-row";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { data: users, error } = await crmDb()
    .from("users")
    .select(
      "id, auth_id, email, name, phone, role, status, tenant_id, owner, access_role_id, document_type, document, billing_legal_name, created_at, updated_at, criado_em, atualizado_em",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenantIds = [
    ...new Set((users ?? []).map((u) => u.tenant_id).filter(Boolean)),
  ] as string[];

  let tenantMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await crmDb()
      .from("hub_tenants")
      .select("id, nome_exibicao, slug")
      .in("id", tenantIds);
    tenantMap = new Map(
      (tenants ?? []).map((t) => [t.id, String(t.nome_exibicao ?? t.slug ?? "")]),
    );
  }

  const rows = (users ?? []).map((u) => {
    const norm = normalizeUserRow(u as Record<string, unknown>);
    return {
      id: String(norm?.id ?? u.id),
      auth_id: u.auth_id ?? null,
      email: String(u.email ?? ""),
      name: String(u.name ?? ""),
      phone: u.phone ?? null,
      role: String(u.role ?? ""),
      status: String(norm?.status ?? u.status ?? "ativo"),
      tenant_id: u.tenant_id ?? null,
      tenant_nome: u.tenant_id ? tenantMap.get(u.tenant_id) ?? null : null,
      owner: u.owner === true,
      access_role_id: u.access_role_id ?? null,
      document_type: u.document_type ?? null,
      document: u.document ?? null,
      billing_legal_name: u.billing_legal_name ?? null,
      criado_em: norm?.criado_em ?? u.created_at ?? null,
    };
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!email || !name) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    email,
    name,
    phone: body.phone ? String(body.phone).trim() : null,
    role: String(body.role ?? "owner").trim() || "owner",
    status: toDbRecordStatus(String(body.status ?? "Ativo")),
    tenant_id: body.tenant_id ? String(body.tenant_id) : null,
    owner: body.owner === true,
    access_role_id: body.access_role_id ? String(body.access_role_id) : null,
    document_type: body.document_type ? String(body.document_type) : null,
    document: body.document ? String(body.document) : null,
    billing_legal_name: body.billing_legal_name ? String(body.billing_legal_name) : null,
  };

  const { data, error } = await crmDb().from("users").insert(payload).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: normalizeUserRow(data as Record<string, unknown>) });
}
