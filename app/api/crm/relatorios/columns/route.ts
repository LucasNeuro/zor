import { NextRequest, NextResponse } from "next/server";
import { listarColunasRelatorio } from "@/lib/crm/relatorios-data";
import { resolveRelatorioViewId, relatorioViewById } from "@/lib/crm/relatorio-views-catalog";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const viewIdParam =
    request.nextUrl.searchParams.get("view_id") ||
    request.nextUrl.searchParams.get("entidade") ||
    "vw_rel_leads_enriquecidos";

  const viewId = resolveRelatorioViewId(viewIdParam);
  if (!relatorioViewById(viewId)) {
    return NextResponse.json({ error: `view_id inválido: ${viewIdParam}` }, { status: 400 });
  }

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  try {
    const meta = await listarColunasRelatorio(supabase, viewId);
    return NextResponse.json(meta);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar colunas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
