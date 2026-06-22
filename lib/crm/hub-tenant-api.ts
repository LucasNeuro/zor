import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveValidatedTenantId } from "@/lib/crm/resolve-tenant-from-caller";

/** Exige tenant válido para rotas Hub; devolve JSON 400 se não resolver. */
export async function requireHubTenantId(
  request: NextRequest,
  options?: { bodyTenantId?: string | null },
): Promise<{ tenantId: string } | NextResponse> {
  const resolved = await resolveValidatedTenantId(request, options);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  return { tenantId: resolved.tenantId };
}
