import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { fetchCrmMetricas } from "@/lib/crm/dashboard-aggregate";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get("since");
  const since =
    sinceParam ||
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    ).toISOString();
  const tenantId = await resolveTenantIdFromCaller(request);
  const metricas = await fetchCrmMetricas(db(), tenantId, since);
  return NextResponse.json(metricas);
}
