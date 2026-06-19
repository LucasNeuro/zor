import { NextRequest, NextResponse } from "next/server";
import { diagnosticarCoraTenant } from "@/lib/cora/cora-diagnostico";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  try {
    const data = await diagnosticarCoraTenant(tenantId);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no diagnóstico Cora.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
