import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const status = request.nextUrl.searchParams.get("status") || "";

  let query = crmDb()
    .from("hub_obras")
    .select("id, codigo, titulo, status, cidade, estado, data_inicio, negocio_id, criado_em", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const year = new Date().getFullYear();
  const { count } = await crmDb().from("hub_obras").select("*", { count: "exact", head: true });
  const codigo = `OBR-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const row = {
    codigo,
    titulo,
    negocio_id: body.negocio_id || null,
    imovel_id: body.imovel_id || null,
    status: body.status || "planejamento",
    endereco: body.endereco || null,
    cidade: body.cidade || null,
    estado: body.estado || null,
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_obras").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
