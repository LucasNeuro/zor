import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireCrmOwner } from "@/lib/crm/crm-api-auth";
import { getAuditoriaActor, logAuditoriaSistema } from "@/lib/crm/auditoria-sistema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_SELECT = "*";

async function resolveTenantIdFromCaller(request: NextRequest): Promise<string> {
  const fallbackTenant = tenantIdFromRequest(request.headers) || defaultTenantId();
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim();
  if (!callerAuthId) return fallbackTenant;

  const { data } = await crmDb()
    .from("users")
    .select("tenant_id")
    .eq("auth_id", callerAuthId)
    .maybeSingle();

  return String(data?.tenant_id ?? fallbackTenant);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ownerErr = await requireCrmOwner(request);
  if (ownerErr) return ownerErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const actor = await getAuditoriaActor(request);
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const { data: before } = await crmDb()
    .from("users")
    .select("name, email, role, status, access_role_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    status?: string;
    access_role_id?: string | null;
    name?: string;
  };

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    updates.name = name;
  }
  if (body.role != null) updates.role = String(body.role).trim().toLowerCase();
  if (body.status != null) updates.status = String(body.status).trim();

  if (body.access_role_id !== undefined) {
    if (body.access_role_id === null || body.access_role_id === "") {
      updates.access_role_id = null;
    } else if (!UUID_RE.test(body.access_role_id)) {
      return NextResponse.json({ error: "Cargo de acesso inválido." }, { status: 400 });
    } else {
      const { data: roleRow, error: roleErr } = await crmDb()
        .from("hub_acesso_cargos")
        .select("id")
        .eq("id", body.access_role_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });
      if (!roleRow) return NextResponse.json({ error: "Cargo não encontrado para esta empresa." }, { status: 404 });
      updates.access_role_id = body.access_role_id;
    }
  }

  const { data, error } = await crmDb()
    .from("users")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(USER_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "usuario_atualizado",
    entidade: "users",
    entidadeId: id,
    resumo: `Usuário "${data.name ?? data.email ?? id}" atualizado`,
    metadata: { antes: before ?? null, depois: updates },
  });

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ownerErr = await requireCrmOwner(request);
  if (ownerErr) return ownerErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const actor = await getAuditoriaActor(request);
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim() ?? "";
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const db = crmDb();
  const { data: current, error: currentErr } = await db
    .from("users")
    .select("id, auth_id, role")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Evita apagar a própria conta logada
  if (current.auth_id && callerAuthId && current.auth_id === callerAuthId) {
    return NextResponse.json({ error: "Não é permitido excluir a própria conta." }, { status: 409 });
  }

  // Evita remover último owner do tenant
  if (String(current.role ?? "").toLowerCase() === "owner") {
    const { count, error: ownersErr } = await db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .neq("id", id);

    if (ownersErr) return NextResponse.json({ error: ownersErr.message }, { status: 500 });
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: "Não é possível excluir o último owner da empresa." },
        { status: 409 }
      );
    }
  }

  const { error } = await db.from("users").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "usuario_excluido",
    entidade: "users",
    entidadeId: id,
    resumo: `Usuário removido (perfil ${String(current.role)})`,
    metadata: { role: current.role },
  });

  return NextResponse.json({ ok: true });
}
