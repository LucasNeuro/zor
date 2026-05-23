import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { aggregateFinanceDashboard } from "@/lib/crm/finance-dashboard-aggregate";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const tenantId = tenantIdFromRequest(request.headers);
  try {
    const payload = await aggregateFinanceDashboard(db(), tenantId);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao agregar painel financeiro";
    console.error("[api/crm/financeiro/dashboard]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
