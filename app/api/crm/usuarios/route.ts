import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  APP_ROLES,
  crmApiConfigError,
  normalizeAppRole,
  requireCrmAdmin,
  requireInternalApiKey,
} from "@/lib/crm/crm-api-auth";
import { ensureAuthUserWithPassword } from "@/lib/crm/auth-admin-user";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { getAuditoriaActor, logAuditoriaSistema } from "@/lib/crm/auditoria-sistema";
import { normalizeUserRow, updateUserById, upsertUserByAuthId } from "@/lib/crm/users-row";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const db = crmDb();

  const [tenantUsersRes, orphansRes] = await Promise.all([
    db.from("users").select("*").eq("tenant_id", tenantId),
    db.from("users").select("*").is("tenant_id", null),
  ]);

  if (tenantUsersRes.error) {
    return NextResponse.json({ error: tenantUsersRes.error.message }, { status: 500 });
  }
  if (orphansRes.error) {
    return NextResponse.json({ error: orphansRes.error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const merged = [...(tenantUsersRes.data ?? []), ...(orphansRes.data ?? [])]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .map((row) => normalizeUserRow(row as Record<string, unknown>))
    .sort((a, b) => {
      const da = String(a?.criado_em ?? a?.created_at ?? "");
      const dbTs = String(b?.criado_em ?? b?.created_at ?? "");
      return dbTs.localeCompare(da);
    });

  return NextResponse.json({ data: merged });
}

export async function POST(request: NextRequest) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
    access_role_id?: string | null;
  };

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || email?.split("@")[0] || "Utilizador";
  const password = String(body.password ?? "");
  /** Perfil interno mínimo; o acesso efectivo vem do cargo (`access_role_id`). */
  const role = normalizeAppRole(body.role ?? "atendente");

  if (!email) return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Senha obrigatória (mínimo 8 caracteres)." }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json(
      { error: `Papel inválido. Use: ${APP_ROLES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!body.access_role_id || !UUID_RE.test(body.access_role_id)) {
    return NextResponse.json({ error: "Cargo de acesso é obrigatório." }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = await resolveTenantIdFromCaller(request);
  const actor = await getAuditoriaActor(request);

  const { data: roleRow, error: roleErr } = await supabase
    .from("hub_acesso_cargos")
    .select("id, nome")
    .eq("id", body.access_role_id)
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .maybeSingle();
  if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });
  if (!roleRow) {
    return NextResponse.json({ error: "Cargo não encontrado ou inativo nesta empresa." }, { status: 404 });
  }
  const accessRoleId = roleRow.id;

  const { data: existing } = await supabase
    .from("users")
    .select("id, tenant_id, auth_id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    if (existing.tenant_id && existing.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Já existe utilizador com este e-mail noutra empresa." }, { status: 409 });
    }
    if (existing.tenant_id === tenantId) {
      return NextResponse.json({ error: "Já existe utilizador com este e-mail nesta empresa." }, { status: 409 });
    }

    const authResult = await ensureAuthUserWithPassword(supabase, { email, password, name });
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 500 });
    }

    const linkedRes = await updateUserById(
      supabase,
      existing.id,
      {
        auth_id: authResult.authId,
        tenant_id: tenantId,
        name,
        role,
        status: "ativo",
        access_role_id: accessRoleId,
      },
      { onlyOrphan: true }
    );

    if (linkedRes.error) return NextResponse.json({ error: linkedRes.error.message }, { status: 500 });
    if (!linkedRes.data) {
      return NextResponse.json({ error: "Já existe utilizador com este e-mail." }, { status: 409 });
    }

    await logAuditoriaSistema({
      tenantId,
      actor,
      acao: "usuario_vinculado",
      entidade: "users",
      entidadeId: linkedRes.data.id as string,
      resumo: `Usuário ${email} vinculado à empresa com senha e cargo de acesso`,
      metadata: { email, role, access_role_id: accessRoleId, cargo_nome: roleRow.nome },
    });

    return NextResponse.json({
      data: linkedRes.data,
      linked: true,
      share: { email, cargo_nome: roleRow.nome },
    }, { status: 200 });
  }

  const authResult = await ensureAuthUserWithPassword(supabase, { email, password, name });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 500 });
  }

  const upsertRes = await upsertUserByAuthId(supabase, {
    auth_id: authResult.authId,
    email,
    name,
    role,
    status: "ativo",
    tenant_id: tenantId,
    access_role_id: accessRoleId,
  });

  if (upsertRes.error) {
    return NextResponse.json({ error: upsertRes.error.message }, { status: 500 });
  }
  if (!upsertRes.data) {
    return NextResponse.json({ error: "Não foi possível gravar o utilizador." }, { status: 500 });
  }

  const row = upsertRes.data;

  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "usuario_cadastrado",
    entidade: "users",
    entidadeId: row.id as string,
    resumo: `Usuário ${email} cadastrado com cargo ${roleRow.nome}`,
    metadata: { email, role, access_role_id: accessRoleId, cargo_nome: roleRow.nome },
  });

  return NextResponse.json({
    data: row,
    created: true,
    share: { email, cargo_nome: roleRow.nome },
  }, { status: 201 });
}
