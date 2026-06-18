import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const ativoParam = request.nextUrl.searchParams.get("ativo");
  const tenantFilter = request.nextUrl.searchParams.get("tenant_id")?.trim();

  let query = crmDb()
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, cargo, ativo, tenant_id, uazapi_instance_id, uazapi_connection_status, arquivado_em, criado_em",
    )
    .order("nome");

  if (ativoParam === "true") query = query.eq("ativo", true);
  if (ativoParam === "false") query = query.eq("ativo", false);
  if (tenantFilter) query = query.eq("tenant_id", tenantFilter);

  const { data: agentes, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenantIds = [
    ...new Set((agentes ?? []).map((a) => a.tenant_id).filter((id): id is string => Boolean(id))),
  ];

  const tenantMap = new Map<string, { slug: string; nome: string }>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await crmDb()
      .from("hub_tenants")
      .select("id, slug, nome_exibicao")
      .in("id", tenantIds);
    for (const t of tenants ?? []) {
      tenantMap.set(t.id, { slug: t.slug, nome: t.nome_exibicao });
    }
  }

  const rows = (agentes ?? []).map((a) => {
    const tenant = a.tenant_id ? tenantMap.get(a.tenant_id) : null;
    const waConectado =
      typeof a.uazapi_connection_status === "string" &&
      ["connected", "open", "online"].includes(a.uazapi_connection_status.toLowerCase());
    return {
      agente_slug: a.agente_slug,
      nome: a.nome,
      cargo: a.cargo ?? null,
      ativo: a.ativo !== false,
      arquivado_em: a.arquivado_em ?? null,
      tenant_id: a.tenant_id ?? null,
      tenant_slug: tenant?.slug ?? null,
      tenant_nome: tenant?.nome ?? null,
      whatsapp_instancia: Boolean(a.uazapi_instance_id),
      whatsapp_conectado: waConectado,
      whatsapp_status: a.uazapi_connection_status ?? null,
      criado_em: a.criado_em,
    };
  });

  return NextResponse.json({ data: rows });
}
