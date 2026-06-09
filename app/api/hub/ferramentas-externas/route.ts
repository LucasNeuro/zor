import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  ferramentaExternaPoliticaValida,
  ferramentaKeyAPartirDeSlugCurto,
  metodoHttpValido,
  slugifyFerramentaExternaSlug,
} from "@/lib/hub/ferramentas-externas-db";
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

const DEFAULT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export async function GET(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);
  const all = new URL(request.url).searchParams.get("all") === "true";

  let q = supabase
    .from("hub_ferramentas_externas")
    .select("*, hub_integracoes(id, nome, integracao_id, status, ativo)")
    .eq("tenant_id", tenantId)
    .order("titulo");
  if (!all) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error) {
    if (error.message.includes("hub_ferramentas_externas") && error.message.includes("relation")) {
      return NextResponse.json(
        { error: "Tabela hub_ferramentas_externas não existe. Execute migrações Supabase." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });

  const slugPart = body.slug_curto != null ? String(body.slug_curto).trim() : "";
  const slugNorm = slugPart ? slugifyFerramentaExternaSlug(slugPart) : slugifyFerramentaExternaSlug(titulo);
  const ferramenta_key = ferramentaKeyAPartirDeSlugCurto(slugNorm);
  if (!ferramenta_key) {
    return NextResponse.json({ error: "slug inválido (use letras minúsculas, números ou _)." }, { status: 400 });
  }

  const descricao_modelo = String(body.descricao_modelo || "").trim();
  if (!descricao_modelo) {
    return NextResponse.json({ error: "descricao_modelo é obrigatória." }, { status: 400 });
  }

  let integracaoId = String(body.integracao_id || body.integracao_row_id || "").trim();
  const conexao = parseConexaoInline(body.conexao);

  if (conexao) {
    try {
      const prov = await provisionIntegracaoInline(supabase, tenantId, {
        nome: `HTTP: ${titulo}`,
        integracaoRowId: integracaoId || null,
        conexao,
      });
      integracaoId = prov.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao provisionar conexão.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (!integracaoId) {
    return NextResponse.json(
      { error: "Configure a conexão HTTP (autenticação) ou seleccione integracao_id." },
      { status: 400 }
    );
  }

  const { data: integracao, error: intErr } = await supabase
    .from("hub_integracoes")
    .select("id, integracao_id, status, ativo")
    .eq("tenant_id", tenantId)
    .eq("id", integracaoId)
    .maybeSingle();

  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 });
  if (!integracao) return NextResponse.json({ error: "Integração não encontrada." }, { status: 404 });
  if (!integracao.ativo) {
    return NextResponse.json({ error: "Integração inactiva." }, { status: 400 });
  }

  const url_template = String(body.url_template || "").trim();
  if (!url_template) return NextResponse.json({ error: "url_template é obrigatório." }, { status: 400 });

  const metodoRaw = String(body.metodo_http ?? "GET").trim().toUpperCase();
  if (!metodoHttpValido(metodoRaw)) {
    return NextResponse.json({ error: "metodo_http inválido." }, { status: 400 });
  }

  const politicaRaw = String(body.politica ?? "leitura").toLowerCase();
  if (!ferramentaExternaPoliticaValida(politicaRaw)) {
    return NextResponse.json({ error: "politica inválida (leitura ou escrita)." }, { status: 400 });
  }

  const descricao_curta =
    body.descricao_curta != null && String(body.descricao_curta).trim()
      ? String(body.descricao_curta).trim()
      : null;

  const headers_template =
    body.headers_template && typeof body.headers_template === "object" && !Array.isArray(body.headers_template)
      ? body.headers_template
      : {};

  const parametros_schema =
    body.parametros_schema &&
    typeof body.parametros_schema === "object" &&
    !Array.isArray(body.parametros_schema)
      ? body.parametros_schema
      : DEFAULT_SCHEMA;

  const row = {
    tenant_id: tenantId,
    ferramenta_key,
    titulo,
    descricao_curta,
    descricao_modelo,
    integracao_id: integracaoId,
    metodo_http: metodoRaw,
    url_template,
    headers_template,
    body_template:
      body.body_template != null && String(body.body_template).trim()
        ? String(body.body_template)
        : null,
    parametros_schema,
    politica: politicaRaw,
    ativo: body.ativo !== false,
  };

  const { data: inserted, error } = await supabase
    .from("hub_ferramentas_externas")
    .insert(row as Record<string, unknown>)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message || "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: `Já existe ferramenta com chave «${ferramenta_key}».` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
