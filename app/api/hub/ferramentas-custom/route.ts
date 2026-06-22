import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  catalogoBuiltinPorId,
  isHubAgenteFerramentaId,
  type HubAgenteFerramentaId,
} from "@/lib/hub/agente-ferramentas-registry";
import {
  ferramentaKeyAPartirDeSlugCurto,
  slugifyFerramentaCustomSlug,
  smartProviderValido,
} from "@/lib/hub/ferramentas-custom-db";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) {
    return NextResponse.json([]);
  }
  const tenantId = tenantResolved.tenantId;
  const all = new URL(request.url).searchParams.get("all") === "true";
  let q = supabase.from("hub_ferramentas_custom").select("*").eq("tenant_id", tenantId).order("titulo");
  if (!all) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const tenantId = tenantResolved.tenantId;

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });

  const slugPart = body.slug_curto != null ? String(body.slug_curto).trim() : "";
  const slugNorm = slugPart ? slugifyFerramentaCustomSlug(slugPart) : slugifyFerramentaCustomSlug(titulo);
  const ferramenta_key = ferramentaKeyAPartirDeSlugCurto(slugNorm);
  if (!ferramenta_key) {
    return NextResponse.json({ error: "slug inválido (use letras minúsculas, números ou _)." }, { status: 400 });
  }

  const builtin_impl = String(body.builtin_impl || "").trim();
  if (!isHubAgenteFerramentaId(builtin_impl)) {
    return NextResponse.json({ error: "builtin_impl deve ser um ID do catálogo Hub." }, { status: 400 });
  }

  const descricao_modelo = String(body.descricao_modelo || "").trim();
  if (!descricao_modelo) {
    return NextResponse.json({ error: "descricao_modelo é obrigatória." }, { status: 400 });
  }

  const descricao_curta =
    body.descricao_curta != null && String(body.descricao_curta).trim()
      ? String(body.descricao_curta).trim()
      : null;

  const smartRaw = String(body.smart_provider ?? "none").toLowerCase();
  if (!smartProviderValido(smartRaw)) {
    return NextResponse.json({ error: "smart_provider inválido." }, { status: 400 });
  }

  const cat = catalogoBuiltinPorId(builtin_impl as HubAgenteFerramentaId);
  if (!cat) return NextResponse.json({ error: "builtin não encontrado no catálogo." }, { status: 400 });

  const row = {
    tenant_id: tenantId,
    ferramenta_key,
    titulo,
    descricao_curta,
    descricao_modelo,
    builtin_impl,
    parametros_schema: cat.mistralFunction.parameters,
    smart_provider: smartRaw,
    smart_model: body.smart_model != null ? String(body.smart_model).trim() || null : null,
    smart_prompt: body.smart_prompt != null ? String(body.smart_prompt).trim() || null : null,
    ativo: body.ativo !== false,
  };

  const { data: inserted, error } = await supabase
    .from("hub_ferramentas_custom")
    .insert(row as Record<string, unknown>)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = error.message || "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: `Já existe ferramenta com chave «${ferramenta_key}».` }, { status: 409 });
    }
    if (msg.includes("hub_ferramentas_custom") && msg.includes("relation")) {
      return NextResponse.json(
        { error: "Tabela hub_ferramentas_custom não existe. Execute migrações Supabase." },
        { status: 503 }
      );
    }
    if (msg.includes("builtin_impl") && msg.includes("schema cache")) {
      return NextResponse.json(
        {
          error:
            "Coluna builtin_impl em falta. Execute no Supabase: supabase/scripts/ensure_hub_ferramentas_custom.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
