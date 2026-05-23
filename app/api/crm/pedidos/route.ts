import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

const SELECT =
  "id, codigo, obra_id, descricao, status, valor_estimado, solicitado_por, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const obraId = request.nextUrl.searchParams.get("obra_id");

  let query = crmDb()
    .from("hub_pedidos_material")
    .select(SELECT)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (obraId) query = query.eq("obra_id", obraId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const descricao = String(body.descricao || "").trim();
  if (!descricao) return NextResponse.json({ error: "Descrição obrigatória" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { count } = await crmDb()
    .from("hub_pedidos_material")
    .select("*", { count: "exact", head: true });
  const codigo = `PED-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, "0")}`;

  const { data, error } = await crmDb()
    .from("hub_pedidos_material")
    .insert({
      codigo,
      descricao,
      obra_id: body.obra_id || null,
      status: body.status || "rascunho",
      valor_estimado: body.valor_estimado != null ? Number(body.valor_estimado) : null,
      solicitado_por: body.solicitado_por || null,
      tenant_id: tenantId,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
