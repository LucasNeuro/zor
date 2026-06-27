import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterOuCriarAgendaLembreteConfig } from "@/lib/hub/agenda-lembrete-db";
import {
  AGENDA_LEMBRETE_MINUTOS_PADRAO,
  AGENDA_LEMBRETE_TEMPLATE_PADRAO,
  normalizarAgendaLembreteConfig,
} from "@/lib/hub/agenda-lembrete-types";

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
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) ||
    tenantResolved.tenantId;

  const config = await obterOuCriarAgendaLembreteConfig(supabase, slug, tenantId);
  if (!config) {
    return NextResponse.json({ error: "Falha ao carregar lembrete de agenda." }, { status: 500 });
  }

  return NextResponse.json({ config });
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

  let body: {
    ativo?: boolean;
    minutos_antes?: number;
    texto_template?: string;
    timezone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const pack = await obterOuCriarAgendaLembreteConfig(supabase, slug, tenantResolved.tenantId);
  if (!pack) {
    return NextResponse.json({ error: "Config não encontrada." }, { status: 500 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (body.minutos_antes !== undefined) {
    const n = Number(body.minutos_antes);
    if (!Number.isFinite(n) || n < 1 || n > 1440) {
      return NextResponse.json({ error: "minutos_antes inválido (1–1440)." }, { status: 400 });
    }
    patch.minutos_antes = Math.round(n);
  }

  if (body.texto_template !== undefined) {
    const t = String(body.texto_template ?? "").trim();
    patch.texto_template = t || AGENDA_LEMBRETE_TEMPLATE_PADRAO;
  }

  if (body.timezone !== undefined) {
    const tz = String(body.timezone ?? "").trim();
    if (tz) patch.timezone = tz;
  }

  const { data, error } = await supabase
    .from("hub_agente_agenda_lembrete_config")
    .update(patch)
    .eq("id", pack.id)
    .select("*")
    .single();

  if (error || !data) {
    const msg = error?.message || "Falha ao guardar.";
    if (/hub_agente_agenda_lembrete/i.test(msg)) {
      return NextResponse.json(
        { error: "Migração hub_agenda_lembrete pendente — aplique no Supabase." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    config: normalizarAgendaLembreteConfig(data as typeof pack),
  });
}
