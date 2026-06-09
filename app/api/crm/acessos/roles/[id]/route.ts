import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireCrmAdmin, requireCrmOwner } from "@/lib/crm/crm-api-auth";
import { getAuditoriaActor, logAuditoriaSistema } from "@/lib/crm/auditoria-sistema";

const ROLE_SELECT = "id, tenant_id, slug, nome, descricao, permissoes, ativo, criado_em, atualizado_em";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const actor = await getAuditoriaActor(request);
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    nome?: string;
    descricao?: string;
    ativo?: boolean;
    permissoes?: Record<string, boolean>;
  };

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.nome != null) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ error: "Nome do cargo é obrigatório." }, { status: 400 });
    updates.nome = nome;
  }
  if (body.descricao != null) updates.descricao = String(body.descricao).trim() || null;
  if (body.ativo != null) updates.ativo = Boolean(body.ativo);
  if (body.permissoes != null && typeof body.permissoes === "object") updates.permissoes = body.permissoes;

  const { data, error } = await crmDb()
    .from("hub_acesso_cargos")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(ROLE_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });

  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "cargo_atualizado",
    entidade: "hub_acesso_cargos",
    entidadeId: id,
    resumo: `Cargo "${data.nome}" atualizado`,
    metadata: { updates: Object.keys(updates).filter((k) => k !== "atualizado_em") },
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
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const db = crmDb();
  const { data: roleRow } = await db
    .from("hub_acesso_cargos")
    .select("nome")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { count, error: linksErr } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("access_role_id", id);
  if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Não é possível excluir: existem usuários vinculados a esse cargo." },
      { status: 409 }
    );
  }

  const { error } = await db.from("hub_acesso_cargos").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "cargo_excluido",
    entidade: "hub_acesso_cargos",
    entidadeId: id,
    resumo: `Cargo "${roleRow?.nome ?? id}" excluído`,
  });

  return NextResponse.json({ ok: true });
}
