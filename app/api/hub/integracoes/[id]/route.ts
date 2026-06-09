import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { integracaoAuthTipoValido, integracaoStatusValido } from "@/lib/hub/ferramentas-externas-db";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.nome !== undefined) {
    const n = String(body.nome).trim();
    if (n) patch.nome = n;
  }
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!integracaoStatusValido(s)) return NextResponse.json({ error: "status inválido." }, { status: 400 });
    patch.status = s;
  }
  if (body.config !== undefined) {
    patch.config =
      body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : {};
  }
  if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);

  const { data, error } = await supabase
    .from("hub_integracoes")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Integração não encontrada." }, { status: 404 });

  if (body.credenciais && typeof body.credenciais === "object" && !Array.isArray(body.credenciais)) {
    const cb = body.credenciais as Record<string, unknown>;
    const tipoAuth =
      cb.tipo_auth != null ? String(cb.tipo_auth).toLowerCase() : undefined;
    const credPayload =
      cb.secrets && typeof cb.secrets === "object" && !Array.isArray(cb.secrets)
        ? cb.secrets
        : cb.credenciais && typeof cb.credenciais === "object" && !Array.isArray(cb.credenciais)
          ? cb.credenciais
          : null;

    const credPatch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (tipoAuth && integracaoAuthTipoValido(tipoAuth)) credPatch.tipo_auth = tipoAuth;
    if (credPayload) credPatch.credenciais = credPayload;

    if (Object.keys(credPatch).length > 1) {
      const { data: existing } = await supabase
        .from("hub_integracao_credenciais")
        .select("id")
        .eq("integracao_id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("hub_integracao_credenciais")
          .update(credPatch)
          .eq("integracao_id", id)
          .eq("tenant_id", tenantId);
      } else if (tipoAuth && integracaoAuthTipoValido(tipoAuth) && credPayload) {
        await supabase.from("hub_integracao_credenciais").insert({
          tenant_id: tenantId,
          integracao_id: id,
          tipo_auth: tipoAuth,
          credenciais: credPayload,
        });
      }
    }
  }

  const { data: full } = await supabase
    .from("hub_integracoes")
    .select("*, hub_integracao_credenciais(*)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return NextResponse.json(full ?? data);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  const { count, error: countErr } = await supabase
    .from("hub_ferramentas_externas")
    .select("id", { count: "exact", head: true })
    .eq("integracao_id", id)
    .eq("tenant_id", tenantId);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Integração ligada a ferramentas externas. Remova-as primeiro." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("hub_integracoes")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const deleted = data?.[0];
  if (!deleted) return NextResponse.json({ error: "Integração não encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, deleted: deleted.id });
}
