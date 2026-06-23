import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterOuCriarFollowupConfig } from "@/lib/hub/followup-db";
import { executarFollowupParaAgente } from "@/lib/hub/followup-runner";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Dispara follow-up manualmente para este agente (leads elegíveis no momento). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const supabase = db();

  const bundle = await obterOuCriarFollowupConfig(supabase, slug, tenantResolved.tenantId);
  if (!bundle) {
    return NextResponse.json({ error: "Não foi possível carregar follow-up." }, { status: 500 });
  }
  const { config, passos } = bundle;
  if (!config.ativo) {
    return NextResponse.json(
      { error: "Ative o follow-up antes de testar." },
      { status: 400 }
    );
  }

  const resultado = await executarFollowupParaAgente(
    supabase,
    config,
    passos as HubAgenteFollowupPasso[]
  );

  return NextResponse.json({
    ok: true,
    resultado,
  });
}
