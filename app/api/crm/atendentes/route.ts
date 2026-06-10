import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import {
  isAtendentesCrmMigrationMissing,
  normalizarTelefoneAtendente,
  slugAtendenteFromNome,
  type AtendenteCrm,
} from "@/lib/crm/atendentes-crm";

const SELECT =
  "id, tenant_id, nome, telefone, slug, email, cargo, agente_slug, ativo, metadata, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  const tenantId = await resolveTenantIdFromCaller(request);
  const apenasAtivos = request.nextUrl.searchParams.get("ativos") !== "false";

  let query = crmDb().from("hub_atendentes_crm").select(SELECT).eq("tenant_id", tenantId).order("nome");
  if (apenasAtivos) query = query.eq("ativo", true);

  const { data, error } = await query;
  if (error) {
    if (isAtendentesCrmMigrationMissing(error.message)) {
      return NextResponse.json({
        atendentes: [],
        aviso:
          "Tabela de equipe ainda não existe no Supabase. Abra SQL Editor e execute o script supabase/scripts/ensure_hub_atendentes_crm.sql (depois recarregue esta página).",
        migration_hint: "ensure_hub_atendentes_crm.sql",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ atendentes: (data ?? []) as AtendenteCrm[] });
}

export async function POST(request: NextRequest) {
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  const telefone = normalizarTelefoneAtendente(String(body.telefone ?? ""));
  if (nome.length < 2) {
    return NextResponse.json({ error: "nome é obrigatório (mín. 2 caracteres)." }, { status: 400 });
  }
  if (telefone.length < 10) {
    return NextResponse.json({ error: "telefone inválido." }, { status: 400 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const slugRaw = String(body.slug ?? "").trim();
  const slug = slugRaw ? slugRaw.slice(0, 80) : slugAtendenteFromNome(nome);

  const row = {
    tenant_id: tenantId,
    nome,
    telefone,
    slug,
    email: String(body.email ?? "").trim() || null,
    cargo: String(body.cargo ?? "").trim() || null,
    agente_slug: String(body.agente_slug ?? "").trim() || null,
    ativo: body.ativo !== false,
  };

  const { data, error } = await crmDb().from("hub_atendentes_crm").insert(row).select(SELECT).single();
  if (error) {
    if (isAtendentesCrmMigrationMissing(error.message)) {
      return NextResponse.json(
        { error: "Tabela hub_atendentes_crm ausente. Aplique a migração no Supabase." },
        { status: 503 }
      );
    }
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um atendente com este telefone." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as AtendenteCrm, { status: 201 });
}
