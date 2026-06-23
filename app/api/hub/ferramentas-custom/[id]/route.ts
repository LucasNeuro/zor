import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  catalogoBuiltinPorId,
  isHubAgenteFerramentaId,
  type HubAgenteFerramentaId,
} from "@/lib/hub/agente-ferramentas-registry";
import { smartProviderValido } from "@/lib/hub/ferramentas-custom-db";
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

  if (body.titulo !== undefined) {
    const t = String(body.titulo).trim();
    if (t) patch.titulo = t;
  }
  if (body.descricao_modelo !== undefined) {
    const d = String(body.descricao_modelo).trim();
    if (d) patch.descricao_modelo = d;
  }
  if (body.descricao_curta !== undefined) {
    patch.descricao_curta =
      body.descricao_curta != null && String(body.descricao_curta).trim()
        ? String(body.descricao_curta).trim()
        : null;
  }

  if (body.builtin_impl != null) {
    const b = String(body.builtin_impl).trim();
    if (!isHubAgenteFerramentaId(b)) {
      return NextResponse.json({ error: "builtin_impl inválido." }, { status: 400 });
    }
    patch.builtin_impl = b;
    const cat = catalogoBuiltinPorId(b);
    if (cat?.mistralFunction) patch.parametros_schema = cat.mistralFunction.parameters;
  }

  if (body.smart_provider != null) {
    const sp = String(body.smart_provider).toLowerCase();
    if (!smartProviderValido(sp)) return NextResponse.json({ error: "smart_provider inválido." }, { status: 400 });
    patch.smart_provider = sp;
  }

  if (body.smart_model !== undefined) {
    patch.smart_model = body.smart_model != null ? String(body.smart_model).trim() || null : null;
  }
  if (body.smart_prompt !== undefined) {
    patch.smart_prompt = body.smart_prompt != null ? String(body.smart_prompt).trim() || null : null;
  }
  if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);

  const { data, error } = await supabase
    .from("hub_ferramentas_custom")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ferramenta não encontrada." }, { status: 404 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  const { data, error } = await supabase
    .from("hub_ferramentas_custom")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const deleted = data?.[0];
  if (!deleted) return NextResponse.json({ error: "Ferramenta não encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, deleted: deleted.id });
}
