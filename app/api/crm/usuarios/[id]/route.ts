import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  APP_ROLES,
  normalizeAppRole,
  requireCrmAdmin,
} from "@/lib/crm/crm-api-auth";
import { updateUserById } from "@/lib/crm/users-row";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    status?: string;
    name?: string;
  };

  const supabase = crmDb();
  const { data: current } = await supabase.from("users").select("id, role").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  const fields: Record<string, unknown> = {};

  if (body.name != null) fields.name = String(body.name).trim();
  if (body.status != null) fields.status = String(body.status).trim();

  if (body.role != null) {
    const role = normalizeAppRole(body.role);
    if (!role) {
      return NextResponse.json(
        { error: `Papel inválido. Use: ${APP_ROLES.join(", ")}` },
        { status: 400 }
      );
    }
    if (String(current.role).toLowerCase() === "owner" && role !== "owner") {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .neq("id", id);
      if ((count ?? 0) === 0) {
        return NextResponse.json(
          { error: "Não é possível remover o último owner da equipa." },
          { status: 409 }
        );
      }
    }
    fields.role = role;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await updateUserById(supabase, id, fields);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}
