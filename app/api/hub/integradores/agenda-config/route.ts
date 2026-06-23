import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import {
  agendaConfigParaRespostaApi,
  gravarTenantAgendaConfig,
  lerTenantAgendaConfig,
  validarPayloadAgendaConfig,
} from "@/lib/hub/tenant-agenda-config";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();
  const cfg = await lerTenantAgendaConfig(supabase, tenantId);
  return NextResponse.json({ ok: true, config: agendaConfigParaRespostaApi(cfg) });
}

export async function PATCH(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const parsed = validarPayloadAgendaConfig(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();
  const saved = await gravarTenantAgendaConfig(supabase, tenantId, parsed.data);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  return NextResponse.json({ ok: true, config: agendaConfigParaRespostaApi(parsed.data) });
}
