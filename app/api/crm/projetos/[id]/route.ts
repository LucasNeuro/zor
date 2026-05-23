import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT = "id, codigo, titulo, status, negocio_id, obra_id, criado_em, atualizado_em";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.titulo != null) updates.titulo = String(body.titulo).trim();
  if (body.status != null) updates.status = body.status;
  if ("negocio_id" in body) updates.negocio_id = body.negocio_id || null;
  if ("obra_id" in body) updates.obra_id = body.obra_id || null;

  const { data, error } = await crmDb()
    .from("hub_projetos")
    .update(updates)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}
