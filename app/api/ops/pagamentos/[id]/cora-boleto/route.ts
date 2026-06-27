import { NextRequest } from "next/server";
import { pagamentoProviderUnavailableResponse } from "@/lib/ops/pagamento-provider-unavailable";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, _ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;
  return pagamentoProviderUnavailableResponse();
}
