import { NextRequest, NextResponse } from "next/server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { sugerirNegocioViaIa } from "@/lib/crm/sugerir-negocio-ia";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  let body: { lead_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (!leadId) {
    return NextResponse.json({ error: "lead_id é obrigatório." }, { status: 400 });
  }

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  try {
    const data = await sugerirNegocioViaIa(supabase, tenantId, leadId);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar sugestão.";
    const status = message.includes("não encontrado") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
