import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterOuCriarFollowupConfig } from "@/lib/hub/followup-db";
import { reativarFollowupLeadsAgente } from "@/lib/hub/followup-lead-state";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
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
  const supabase = db();

  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id, modo_operacao")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) ||
    tenantResolved.tenantId;

  const pack = await obterOuCriarFollowupConfig(supabase, slug, tenantId);
  if (!pack) {
    return NextResponse.json({ error: "Falha ao carregar follow-up." }, { status: 500 });
  }

  return NextResponse.json({
    config: pack.config,
    passos: pack.passos,
    modo_operacao: agente.modo_operacao ?? null,
  });
}

export async function PATCH(
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

  let body: { ativo?: boolean; arquivar_apos_dias?: number };
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

  const patch: Record<string, unknown> = {};
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (body.arquivar_apos_dias != null) {
    const d = Number.parseInt(String(body.arquivar_apos_dias), 10);
    if (!Number.isFinite(d) || d < 1 || d > 365) {
      return NextResponse.json({ error: "arquivar_apos_dias inválido (1–365)." }, { status: 400 });
    }
    patch.arquivar_apos_dias = d;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_agente_followup_config")
    .update(patch)
    .eq("id", pack.config.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let leadsReativados = 0;
  if (patch.ativo === true) {
    leadsReativados = await reativarFollowupLeadsAgente(supabase, slug);
  }

  const { data: passos } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("config_id", pack.config.id)
    .order("ordem");

  return NextResponse.json({
    config: data,
    passos: passos || [],
    leads_reativados: leadsReativados,
  });
}
