import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { aggregateAnalytics } from "@/lib/crm/analytics-aggregate";
import { parseAnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const periodo = parseAnalyticsPeriodo(request.nextUrl.searchParams.get("periodo"));
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  try {
    const payload = await aggregateAnalytics(crmDb(), tenantId, periodo);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao agregar analytics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
