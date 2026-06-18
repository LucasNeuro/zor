import { NextRequest, NextResponse } from "next/server";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const actor = await getOpsActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Sessão operacional inválida." }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      auth_id: actor.authId,
      email: actor.email,
      name: actor.name,
      role: actor.role,
    },
  });
}
