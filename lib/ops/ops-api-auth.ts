import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { verifyOpsUserForAuth } from "@/lib/auth/verify-ops-user";
import { NextResponse } from "next/server";

function opsApiConfigError(): NextResponse | null {
  const err = crmConfigError();
  if (err) return NextResponse.json({ error: err }, { status: 503 });
  return null;
}

export type OpsActor = {
  authId: string;
  email: string;
  name: string;
  role: string;
};

export async function getOpsActor(request: Request): Promise<OpsActor | null> {
  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) return null;

  const check = await verifyOpsUserForAuth(authId);
  if (!check.ok) return null;

  const { data } = await crmDb()
    .from("users")
    .select("email, name, role, owner")
    .eq("auth_id", authId)
    .maybeSingle();

  return {
    authId,
    email: String(data?.email ?? ""),
    name: String(data?.name ?? ""),
    role: String(data?.role ?? "owner"),
  };
}

/** Rotas /api/ops: exige utilizador operacional (x-caller-auth-id) ou chave interna. */
export async function requireOpsApiAccess(request: Request): Promise<NextResponse | null> {
  const config = opsApiConfigError();
  if (config) return config;

  const expected = process.env.INTERNAL_API_KEY?.trim();
  const got = request.headers.get("x-api-key")?.trim();
  if (expected && got === expected) return null;

  const actor = await getOpsActor(request);
  if (actor) return null;

  return NextResponse.json({ error: "Acesso operacional negado." }, { status: 403 });
}
