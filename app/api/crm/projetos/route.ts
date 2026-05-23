import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

const SELECT = "id, codigo, titulo, status, negocio_id, obra_id, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const negocioId = request.nextUrl.searchParams.get("negocio_id");

  let query = crmDb()
    .from("hub_projetos")
    .select(SELECT)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (negocioId) query = query.eq("negocio_id", negocioId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { count } = await crmDb().from("hub_projetos").select("*", { count: "exact", head: true });
  const codigo = `PRJ-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data, error } = await crmDb()
    .from("hub_projetos")
    .insert({
      codigo,
      titulo,
      status: body.status || "briefing",
      negocio_id: body.negocio_id || null,
      obra_id: body.obra_id || null,
      tenant_id: tenantId,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
