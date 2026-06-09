import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { normalizeUserRow } from "@/lib/crm/users-row";

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) {
    return NextResponse.json({ error: "Cabeçalho x-caller-auth-id obrigatório." }, { status: 403 });
  }

  const { data: user, error } = await crmDb()
    .from("users")
    .select("id, role, status, access_role_id, tenant_id, name, email")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });

  let permissoes: Record<string, boolean> | null = null;
  let cargo_nome: string | null = null;

  if (user.access_role_id) {
    const { data: cargo, error: cargoErr } = await crmDb()
      .from("hub_acesso_cargos")
      .select("nome, permissoes, ativo")
      .eq("id", user.access_role_id)
      .maybeSingle();

    if (cargoErr) return NextResponse.json({ error: cargoErr.message }, { status: 500 });
    if (cargo?.ativo) {
      permissoes =
        cargo.permissoes && typeof cargo.permissoes === "object"
          ? (cargo.permissoes as Record<string, boolean>)
          : {};
      cargo_nome = cargo.nome ?? null;
    }
  }

  return NextResponse.json({
    data: {
      user: normalizeUserRow(user as Record<string, unknown>),
      role: String(user.role ?? ""),
      access_role_id: user.access_role_id ?? null,
      cargo_nome,
      permissoes,
    },
  });
}
