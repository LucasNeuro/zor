import { NextRequest, NextResponse } from "next/server";
import { crmDb, crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { verificarSchemaCrmWaje } from "@/lib/crm/schema-status";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const supabase = crmDb();
  const status = await verificarSchemaCrmWaje(supabase);
  return NextResponse.json(status);
}
