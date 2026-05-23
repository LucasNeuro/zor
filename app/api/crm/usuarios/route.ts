import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  APP_ROLES,
  crmApiConfigError,
  normalizeAppRole,
  requireCrmAdmin,
  requireInternalApiKey,
} from "@/lib/crm/crm-api-auth";

const USER_SELECT = "id, auth_id, email, name, role, status, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const { data, error } = await crmDb()
    .from("users")
    .select(USER_SELECT)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || email?.split("@")[0] || "Utilizador";
  const role = normalizeAppRole(body.role ?? "vendedor");

  if (!email) return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  if (!role) {
    return NextResponse.json(
      { error: `Papel inválido. Use: ${APP_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = crmDb();

  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Já existe utilizador com este e-mail." }, { status: 409 });
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""}/login`,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const authId = inviteData.user?.id;
  if (!authId) {
    return NextResponse.json({ error: "Convite enviado mas sem ID de utilizador." }, { status: 500 });
  }

  const { data: row, error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        auth_id: authId,
        email,
        name,
        role,
        status: "Ativo",
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "auth_id" }
    )
    .select(USER_SELECT)
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ data: row, invited: true }, { status: 201 });
}
