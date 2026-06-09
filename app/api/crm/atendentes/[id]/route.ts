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

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const updates: Record<string, unknown> = {};

  if (body.nome !== undefined) {
    const nome = String(body.nome).trim();
    if (nome.length < 2) {
      return NextResponse.json({ error: "nome inválido." }, { status: 400 });
    }
    updates.nome = nome;
  }
  if (body.telefone !== undefined) {
    const tel = normalizarTelefoneAtendente(String(body.telefone));
    if (tel.length < 10) {
      return NextResponse.json({ error: "telefone inválido." }, { status: 400 });
    }
    updates.telefone = tel;
  }
  if (body.slug !== undefined) {
    const s = String(body.slug).trim();
    updates.slug = s ? s.slice(0, 80) : null;
  }
  if (body.email !== undefined) {
    updates.email = String(body.email).trim() || null;
  }
  if (body.cargo !== undefined) {
    updates.cargo = String(body.cargo).trim() || null;
  }
  if (body.agente_slug !== undefined) {
    updates.agente_slug = String(body.agente_slug).trim() || null;
  }
  if (body.ativo !== undefined) {
    updates.ativo = Boolean(body.ativo);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  if (updates.nome && updates.slug === undefined && body.slug === undefined) {
    updates.slug = slugAtendenteFromNome(String(updates.nome));
  }

  const { data, error } = await crmDb()
    .from("hub_atendentes_crm")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    if (isAtendentesCrmMigrationMissing(error.message)) {
      return NextResponse.json({ error: "Migração hub_atendentes_crm ausente." }, { status: 503 });
    }
    if (error.code === "23505") {
      return NextResponse.json({ error: "Telefone já cadastrado para outro atendente." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Atendente não encontrado." }, { status: 404 });

  return NextResponse.json(data as AtendenteCrm);
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const cfg = crmConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 503 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  const tenantId = await resolveTenantIdFromCaller(request);

  const { data, error } = await crmDb()
    .from("hub_atendentes_crm")
    .update({ ativo: false })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isAtendentesCrmMigrationMissing(error.message)) {
      return NextResponse.json({ error: "Migração hub_atendentes_crm ausente." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Atendente não encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
