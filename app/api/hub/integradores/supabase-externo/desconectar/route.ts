import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { SUPABASE_EXTERNO_INTEGRADOR_ID } from "@/lib/hub/supabase-externo-constants";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  const { data: row } = await supabase
    .from("hub_integracoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", SUPABASE_EXTERNO_INTEGRADOR_ID)
    .maybeSingle();

  if (!row?.id) {
    return NextResponse.json({ ok: true, desconectado: false });
  }

  const hubId = String(row.id);
  await supabase.from("hub_integracao_credenciais").delete().eq("integracao_id", hubId).eq("tenant_id", tenantId);
  await supabase
    .from("hub_integracoes")
    .update({ ativo: false, status: "inativo", atualizado_em: new Date().toISOString() })
    .eq("id", hubId)
    .eq("tenant_id", tenantId);

  return NextResponse.json({ ok: true, desconectado: true });
}
