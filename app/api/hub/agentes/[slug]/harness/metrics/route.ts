import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterMetricasAgenteHarness } from "@/lib/harness/stores/session-metrics";
import { listarPendingWritesAgente } from "@/lib/harness/stores/pending-approvals";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET — métricas harness do agente (RFC Fase 5) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

  const supabase = db();
  const [metricas, pending] = await Promise.all([
    obterMetricasAgenteHarness(supabase, tenantId, slug),
    listarPendingWritesAgente(supabase, tenantId, slug),
  ]);

  return NextResponse.json({
    ok: true,
    metricas,
    pending_approvals: pending,
  });
}
