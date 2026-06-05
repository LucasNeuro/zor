import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireInternalApiKey, requireCrmOwner } from "@/lib/crm/crm-api-auth";
import { getAuditoriaActor, logAuditoriaSistema } from "@/lib/crm/auditoria-sistema";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

const ROLE_SELECT = "id, tenant_id, slug, nome, descricao, permissoes, ativo, criado_em, atualizado_em";
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

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const authId = request.headers.get("x-caller-auth-id")?.trim() ?? "";

  const db = crmDb();
  const [rolesRes, usersRes, meRes] = await Promise.all([
    db.from("hub_acesso_cargos").select(ROLE_SELECT).eq("tenant_id", tenantId).order("nome", { ascending: true }),
    db.from("users").select(USER_SELECT).eq("tenant_id", tenantId).order("name", { ascending: true }),
    db.from("users").select(USER_SELECT).eq("auth_id", authId).maybeSingle(),
  ]);

  if (rolesRes.error) return NextResponse.json({ error: rolesRes.error.message }, { status: 500 });
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  if (meRes.error) return NextResponse.json({ error: meRes.error.message }, { status: 500 });

  return NextResponse.json({
    data: {
      tenantId,
      roles: rolesRes.data ?? [],
      users: usersRes.data ?? [],
      me: meRes.data ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  const ownerErr = await requireCrmOwner(request);
  if (ownerErr) return ownerErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    nome?: string;
    descricao?: string;
    permissoes?: Record<string, boolean>;
    ativo?: boolean;
  };

  const nome = String(body.nome ?? "").trim();
  const slugBase = String(body.slug ?? nome).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = slugBase.slice(0, 60);
  if (!nome) return NextResponse.json({ error: "Nome do cargo é obrigatório." }, { status: 400 });
  if (!slug) return NextResponse.json({ error: "Slug inválido para o cargo." }, { status: 400 });

  const permissoes = body.permissoes && typeof body.permissoes === "object" ? body.permissoes : {};

  const { data, error } = await crmDb()
    .from("hub_acesso_cargos")
    .insert({
      tenant_id: tenantId,
      slug,
      nome,
      descricao: String(body.descricao ?? "").trim() || null,
      permissoes,
      ativo: body.ativo == null ? true : Boolean(body.ativo),
    })
    .select(ROLE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um cargo com esse slug nesta empresa." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actor = await getAuditoriaActor(request);
  await logAuditoriaSistema({
    tenantId,
    actor,
    acao: "cargo_criado",
    entidade: "hub_acesso_cargos",
    entidadeId: data.id,
    resumo: `Cargo "${data.nome}" criado`,
    metadata: { slug: data.slug },
  });

  return NextResponse.json({ data }, { status: 201 });
}
