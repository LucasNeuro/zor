import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { isCrmAdminRole } from "@/lib/crm-nav-groups";
import { NextResponse } from "next/server";

export function crmApiConfigError(): NextResponse | null {
  const err = crmConfigError();
  if (err) return NextResponse.json({ error: err }, { status: 503 });
  return null;
}

/** Rotas CRM server: exige chave interna (mesmo critério que proxy). */
export function requireInternalApiKey(request: Request): NextResponse | null {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return null;
  const got = request.headers.get("x-api-key")?.trim();
  if (got !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}

/** Admin-only: header opcional `x-caller-auth-id` (UUID Supabase Auth). */
export async function requireCrmAdmin(request: Request): Promise<NextResponse | null> {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) {
    return NextResponse.json(
      { error: "Cabeçalho x-caller-auth-id obrigatório para esta operação." },
      { status: 403 }
    );
  }

  const { data, error } = await crmDb()
    .from("users")
    .select("role, status")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !isCrmAdminRole(String(data.role ?? ""))) {
    return NextResponse.json({ error: "Apenas administradores podem executar esta ação." }, { status: 403 });
  }
  const status = String(data.status ?? "").trim().toLowerCase();
  if (status && status !== "ativo") {
    return NextResponse.json({ error: "Conta inativa." }, { status: 403 });
  }
  return null;
}

export const APP_ROLES = ["owner", "admin", "vendedor", "atendente", "parceiro"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function normalizeAppRole(role: string): AppRole | null {
  const r = role.trim().toLowerCase();
  return (APP_ROLES as readonly string[]).includes(r) ? (r as AppRole) : null;
}
