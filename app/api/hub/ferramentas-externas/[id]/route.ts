import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ferramentaExternaPoliticaValida, metodoHttpValido } from "@/lib/hub/ferramentas-externas-db";
import {
  provisionIntegracaoInline,
  type ConexaoInlinePayload,
} from "@/lib/hub/provision-integracao-inline";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function parseConexaoInline(raw: unknown): ConexaoInlinePayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tipo = String(o.tipo_auth ?? "none").toLowerCase();
  if (tipo !== "none" && tipo !== "api_key" && tipo !== "bearer") return null;
  const allowedRaw = o.allowed_hosts;
  const allowed_hosts = Array.isArray(allowedRaw)
    ? allowedRaw.map((h) => String(h).trim()).filter(Boolean)
    : typeof allowedRaw === "string"
      ? allowedRaw.split(",").map((h) => h.trim()).filter(Boolean)
      : null;
  return {
    tipo_auth: tipo,
    bearer_token: o.bearer_token != null ? String(o.bearer_token) : null,
    api_key: o.api_key != null ? String(o.api_key) : null,
    api_key_header: o.api_key_header != null ? String(o.api_key_header) : null,
    allowed_hosts,
  };
}

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

  const { data: existing } = await supabase
    .from("hub_ferramentas_externas")
    .select("id, titulo, integracao_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Ferramenta não encontrada." }, { status: 404 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  const conexao = parseConexaoInline(body.conexao);
  if (conexao) {
    try {
      const tituloRef =
        body.titulo !== undefined ? String(body.titulo).trim() : String(existing.titulo || "Ferramenta");
      const prov = await provisionIntegracaoInline(supabase, tenantId, {
        nome: `HTTP: ${tituloRef || "Ferramenta"}`,
        integracaoRowId: String(existing.integracao_id || ""),
        conexao,
      });
      patch.integracao_id = prov.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao actualizar conexão.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

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
  if (body.integracao_id !== undefined) {
    const intId = String(body.integracao_id).trim();
    if (!intId) return NextResponse.json({ error: "integracao_id inválido." }, { status: 400 });
    const { data: integracao } = await supabase
      .from("hub_integracoes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", intId)
      .maybeSingle();
    if (!integracao) return NextResponse.json({ error: "Integração não encontrada." }, { status: 404 });
    patch.integracao_id = intId;
  }
  if (body.metodo_http !== undefined) {
    const m = String(body.metodo_http).trim().toUpperCase();
    if (!metodoHttpValido(m)) return NextResponse.json({ error: "metodo_http inválido." }, { status: 400 });
    patch.metodo_http = m;
  }
  if (body.url_template !== undefined) {
    const u = String(body.url_template).trim();
    if (u) patch.url_template = u;
  }
  if (body.headers_template !== undefined) {
    patch.headers_template =
      body.headers_template && typeof body.headers_template === "object" && !Array.isArray(body.headers_template)
        ? body.headers_template
        : {};
  }
  if (body.body_template !== undefined) {
    patch.body_template =
      body.body_template != null && String(body.body_template).trim()
        ? String(body.body_template)
        : null;
  }
  if (body.parametros_schema !== undefined) {
    patch.parametros_schema =
      body.parametros_schema &&
      typeof body.parametros_schema === "object" &&
      !Array.isArray(body.parametros_schema)
        ? body.parametros_schema
        : { type: "object", properties: {}, additionalProperties: false };
  }
  if (body.politica !== undefined) {
    const p = String(body.politica).toLowerCase();
    if (!ferramentaExternaPoliticaValida(p)) {
      return NextResponse.json({ error: "politica inválida." }, { status: 400 });
    }
    patch.politica = p;
  }
  if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo);

  const { data, error } = await supabase
    .from("hub_ferramentas_externas")
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
    .from("hub_ferramentas_externas")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, ferramenta_key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const deleted = data?.[0];
  if (!deleted) return NextResponse.json({ error: "Ferramenta não encontrada." }, { status: 404 });

  return NextResponse.json({ ok: true, deleted: deleted.id, ferramenta_key: deleted.ferramenta_key });
}
