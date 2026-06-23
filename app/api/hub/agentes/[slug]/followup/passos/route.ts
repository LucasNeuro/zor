import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterOuCriarFollowupConfig } from "@/lib/hub/followup-db";
import type { FollowupTipoConteudo } from "@/lib/hub/followup-types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseTipo(v: unknown): FollowupTipoConteudo | null {
  const s = String(v || "texto");
  if (s === "texto" || s === "imagem" || s === "texto_imagem") return s;
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const pack = await obterOuCriarFollowupConfig(supabase, slug, tenantResolved.tenantId);
  if (!pack) {
    return NextResponse.json({ error: "Config não encontrada" }, { status: 404 });
  }

  const ordem = Number.parseInt(String(body.ordem ?? ""), 10);
  const atraso_horas = Number.parseInt(String(body.atraso_horas ?? ""), 10);
  if (!Number.isFinite(ordem) || ordem < 1 || ordem > 24) {
    return NextResponse.json({ error: "ordem inválida (1–24)." }, { status: 400 });
  }
  if (!Number.isFinite(atraso_horas) || atraso_horas < 1 || atraso_horas > 8760) {
    return NextResponse.json({ error: "atraso_horas inválido." }, { status: 400 });
  }

  const tipo = parseTipo(body.tipo_conteudo);
  if (!tipo) return NextResponse.json({ error: "tipo_conteudo inválido." }, { status: 400 });

  const row = {
    config_id: pack.config.id,
    tenant_id: tenantResolved.tenantId,
    agente_slug: slug,
    ordem,
    atraso_horas,
    tipo_conteudo: tipo,
    texto_template: body.texto_template != null ? String(body.texto_template) : null,
    imagem_url: body.imagem_url != null ? String(body.imagem_url).trim() || null : null,
    legenda_imagem: body.legenda_imagem != null ? String(body.legenda_imagem) : null,
    ativo: body.ativo !== false,
  };

  const { data, error } = await supabase
    .from("hub_agente_followup_passo")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("unique") || error.message.includes("duplicate")) {
      return NextResponse.json({ error: "Já existe passo com esta ordem." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ passo: data });
}
