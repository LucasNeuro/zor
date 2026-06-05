import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { normalizeUserRow, updateUserByAuthId } from "@/lib/crm/users-row";

function callerAuthIdFromRequest(request: NextRequest): string | null {
  const authId = request.headers.get("x-caller-auth-id")?.trim();
  return authId || null;
}

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const authId = callerAuthIdFromRequest(request);
  if (!authId) {
    return NextResponse.json(
      { error: "Cabeçalho x-caller-auth-id obrigatório." },
      { status: 403 }
    );
  }

  const { data, error } = await crmDb()
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  return NextResponse.json({ data: normalizeUserRow(data as Record<string, unknown>) });
}

export async function PATCH(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const authId = callerAuthIdFromRequest(request);
  if (!authId) {
    return NextResponse.json(
      { error: "Cabeçalho x-caller-auth-id obrigatório." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "Nome muito longo." }, { status: 400 });
  }

  const { data, error } = await updateUserByAuthId(crmDb(), authId, { name });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  return NextResponse.json({ data });
}
