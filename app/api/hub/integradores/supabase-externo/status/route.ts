import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { WAJE_CRM_INTEGRADOR_ID } from "@/lib/hub/crm-integrador-constants";
import { credenciaisSupabaseExternoDeRow } from "@/lib/hub/supabase-externo-query";
import { SUPABASE_EXTERNO_INTEGRADOR_ID } from "@/lib/hub/supabase-externo-constants";
import { tenantIdFromRequest } from "@/lib/tenant-default";

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

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  const wajeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;

  const { data: extRow } = await supabase
    .from("hub_integracoes")
    .select("id, config, ativo, hub_integracao_credenciais(credenciais)")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", SUPABASE_EXTERNO_INTEGRADOR_ID)
    .eq("ativo", true)
    .maybeSingle();

  const creds = extRow?.hub_integracao_credenciais;
  const credRow = Array.isArray(creds) ? creds[0] : creds;
  const credObj =
    credRow &&
    typeof credRow === "object" &&
    "credenciais" in credRow &&
    credRow.credenciais &&
    typeof credRow.credenciais === "object"
      ? (credRow.credenciais as Record<string, unknown>)
      : {};

  const extCred = credenciaisSupabaseExternoDeRow(credObj);
  const cfg =
    extRow?.config && typeof extRow.config === "object"
      ? (extRow.config as Record<string, unknown>)
      : {};

  return NextResponse.json({
    waje_crm: {
      integrador_id: WAJE_CRM_INTEGRADOR_ID,
      configurado: Boolean(wajeUrl),
      project_url_mascarado: wajeUrl ? wajeUrl.replace(/^https?:\/\//, "").split(".")[0] + ".supabase.co" : null,
    },
    supabase_externo: {
      integrador_id: SUPABASE_EXTERNO_INTEGRADOR_ID,
      configurado: Boolean(extCred),
      project_host: extCred?.project_url ? new URL(extCred.project_url).host : null,
      rotulo: typeof cfg.rotulo === "string" ? cfg.rotulo : null,
    },
  });
}
